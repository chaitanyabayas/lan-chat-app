// server.js

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo'); // Import connect-mongo
require('dotenv').config();

const app = express();
const path = require('path');
const server = http.createServer(app);
const io = socketIO(server);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

// Define Message schema and model
const messageSchema = new mongoose.Schema({
    username: String,
    sender: String,
    receiver: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false }
});
const Message = mongoose.model('Message', messageSchema);

// Define User schema and model
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
});
const User = mongoose.model('User', userSchema);

// Configure session store
const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_URI,
    collectionName: 'sessions',
});

// Configure session middleware
app.use(session({
    secret: 'yourSecretKey', // Change this to a strong, unique key
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: { secure: false } // Set to true if using HTTPS
}));

app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the login page
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/chat');
    } else {
        res.sendFile(__dirname + '/public/html/login.html');
    }
});

// Handle login requests
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username, password });
        if (user) {
            req.session.userId = user._id; // Store user ID in session
            req.session.username = username; // Store username in session
            res.redirect('/chat');
        } else {
            res.redirect('/register');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

// Serve the registration page
app.get('/register', (req, res) => {
    res.sendFile(__dirname + '/public/html/register.html');
});

// Handle registration requests
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    try {
        await newUser.save();
        req.session.userId = newUser._id; // Store user ID in session after registration
        req.session.username = username; // Store username in session
        res.redirect('/chat');
    } catch (err) {
        console.error(err);
        res.send('Registration failed, username might be taken. Please try again.');
    }
});

// Serve the chat page for authenticated users
app.get('/chat', (req, res) => {
    if (req.session.userId) {
        res.sendFile(__dirname + '/public/html/index.html');
    } else {
        res.redirect('/');
    }
});

// Handle logout requests
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Could not log out. Please try again.');
        }
        res.redirect('/');
    });
});

// Middleware to attach session to Socket.IO
io.use((socket, next) => {
    session({
        secret: 'yourSecretKey',
        resave: false,
        saveUninitialized: true,
        store: sessionStore,
        cookie: { secure: false } // Set to true if using HTTPS
    })(socket.request, {}, next);
});


// Socket connection handling
io.on('connection', (socket) => {
    console.log('A user connected');

    // Access session and get username
    const session = socket.request.session;
    if (session && session.username) {
        console.log('Connected user:', session.username);
    }

    // Notify user of their username
    socket.emit('username', session.username);

    // Load recent group messages from the database
    Message.find({ isPrivate: false }).sort({ timestamp: -1 }).limit(50).then((messages) => {
        socket.emit('load group messages', messages.reverse());
    }).catch(err => {
        console.error('Error loading messages:', err);
    });

    
    // Load recent group messages from the database
    Message.find({ isPrivate: true }).sort({ timestamp: -1 }).limit(50).then((messages) => {
        socket.emit('load private messages', messages.reverse());
    }).catch(err => {
        console.error('Error loading messages:', err);
    });

     // Handle group chat messages
     socket.on('group message', (msg) => {
        const session = socket.request.session;
        console.log('Session username:', session.username);

        if (!session.username) {
            console.error('Username is not available in session');
            return;
        }

        const newMessage = new Message({
            username: session.username,
            sender: session.username,
            message: msg.message,
            isPrivate: false
        });

        newMessage.save()
            .then(() => {
                io.emit('group message', newMessage);
            })
            .catch(err => {
                console.error('Error saving group message:', err);
            });
    });

    // Handle private chat messages
    socket.on('private message', async (msg) => {
        if (!msg.receiver) return;
        try {
        const session = socket.request.session;
        console.log('Session username:', session.username);

        if (!session.username) {
            console.error('Username is not available in session');
            return;
        }

        const receiver = await User.findOne({ username: msg.receiver });

        if (!receiver) {
            socket.emit('private message error', `User "${msg.receiver}" does not exist.`);
            return;
        }

        const newMessage = new Message({
            username: session.username,
            sender: session.username,
            receiver: msg.receiver,
            message: msg.message,
            isPrivate: true
        });

        await newMessage.save();

        io.to(msg.receiver).emit('private message', newMessage); // Send to receiver
        socket.emit('private message', newMessage); // Send to sender
        } catch (err) {
            console.error('Error sending private message:', err);
        }
    });

    // Handle user connection for private messages
    socket.on('join', (username) => {
        socket.join(username); // Join a room named after the username
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
});
