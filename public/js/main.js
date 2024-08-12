// public/js/main.js

const socket = io();

const groupForm = document.getElementById('group-form');
const groupInput = document.getElementById('group-input');
const groupMessages = document.getElementById('group-messages');

const privateForm = document.getElementById('private-form');
const receiverInput = document.getElementById('receiver');
const privateInput = document.getElementById('private-input');
const privateChatBoxes = document.getElementById('private-chat-boxes');
const privateMessageError = document.getElementById('private-message-error'); // Error display element


// Fetch the username from the server
let username = '';

// Emit an event to get the username
socket.emit('get username');

// Set the username when received
socket.on('username', (name) => {
    username = name;
});

// Emit the username to join a private chat room
socket.emit('join', username); // Replace 'YOUR_USERNAME' with actual username logic


document.addEventListener('DOMContentLoaded', () => {

    // Function to scroll to bottom of a container
    function scrollToBottom(container) {
        container.scrollTop = container.scrollHeight;
    }

    // Function to create a new private chat box
    function createPrivateChatBox(receiver) {
        const chatBoxId = `chat-${receiver}`;

        // Check if chat box already exists
        if (!document.getElementById(chatBoxId)) {
            const chatBox = document.createElement('div');
            chatBox.className = 'private-chat-box';
            chatBox.id = chatBoxId;

            const chatTitle = document.createElement('h3');
                chatTitle.textContent = `Chat with ${receiver}`;
                chatTitle.className = 'collapsible-title';
                chatBox.appendChild(chatTitle);

                const messageList = document.createElement('ul');
                messageList.className = 'private-messages list-unstyled collapsible-content';
                chatBox.appendChild(messageList);

                privateChatBoxes.appendChild(chatBox);

                // Add event listener to title to toggle collapsible content
                chatTitle.addEventListener('click', () => {
                    messageList.classList.toggle('collapsible-content');
                });

        }
    }

    // Handle messages
    socket.on('load group messages', (messages) => {
        groupMessages.innerHTML = ''; // Clear existing messages
        messages.forEach((msg) => {
            // Handle group messages
            if (!msg.isPrivate) {
                const messageElement = document.createElement('li');
                if (msg.sender == username) {
                    messageElement.textContent = `${msg.sender}: ${msg.message}`;
                    messageElement.classList.add('message-sent');
                } else {
                    messageElement.textContent = `${msg.sender}: ${msg.message}`;
                    messageElement.classList.add('message-received');
                }
                groupMessages.appendChild(messageElement);
            }
        });
        scrollToBottom(groupMessages); // Auto-scroll
    });


    // Handle private message errors
    socket.on('private message error', (errorMsg) => {
        privateMessageError.textContent = errorMsg; // Display error message
    });

    // Handle messages
    socket.on('load private messages', (messages) => {
        messages.forEach((msg) => {
            createPrivateChatBox(msg.sender === username ? msg.receiver : msg.sender);
            const messageList = document.querySelector(`#chat-${msg.sender === username ? msg.receiver : msg.sender} .private-messages`);
            if (msg.isPrivate) {
                const messageElement = document.createElement('li');
                if (msg.sender == username) {
                    messageElement.textContent = `${msg.sender} (to ${msg.receiver}): ${msg.message}`;
                    messageElement.classList.add('message-sent');
                } else {
                    messageElement.textContent = `${msg.sender} (to ${msg.receiver}): ${msg.message}`;
                    messageElement.classList.add('message-received');
                }
                messageList.appendChild(messageElement);
            }
            scrollToBottom(messageList); // Auto-scroll
        });
        // scrollToBottom(privateChatBoxes); // Auto-scroll
    });

    // Send group message
    document.getElementById('group-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const messageInput = document.getElementById('group-input');
        socket.emit('group message', { message: messageInput.value });
        messageInput.value = ''; // Clear input
    });

    // Send private message
    document.getElementById('private-form').addEventListener('submit', (event) => {
        event.preventDefault();
        const receiverInput = document.getElementById('receiver');
        const privateInput = document.getElementById('private-input');

        // Clear previous error message
        privateMessageError.textContent = '';

        if (privateMessageError.textContent == '' && receiverInput.value) {
            createPrivateChatBox(receiverInput.value);

            socket.emit('private message', {
                receiver: receiverInput.value,
                message: privateInput.value
            });

            privateInput.value = ''; // Clear input
        } else {
            privateMessageError.textContent = 'Please enter a receiver username.';
        }
    });

    // Handle new group messages
    socket.on('group message', (msg) => {
        if (!msg.isPrivate) {
            const messageElement = document.createElement('li');
            if (msg.sender == username) {
                messageElement.textContent = `${msg.sender}: ${msg.message}`;
                messageElement.classList.add('message-sent');
            } else {
                messageElement.textContent = `${msg.sender}: ${msg.message}`;
                messageElement.classList.add('message-received');
            }
            groupMessages.appendChild(messageElement);
        }
        scrollToBottom(groupMessages); // Auto-scroll
    });

    // Handle new private messages
    socket.on('private message', (msg) => {
        createPrivateChatBox(msg.sender === username ? msg.receiver : msg.sender);
        const messageList = document.querySelector(`#chat-${msg.sender === username ? msg.receiver : msg.sender} .private-messages`);
        if (msg.isPrivate) {
            const messageElement = document.createElement('li');
            if (msg.sender == username) {
                messageElement.textContent = `${msg.sender} (to ${msg.receiver}): ${msg.message}`;
                messageElement.classList.add('message-sent');
            } else {
                messageElement.textContent = `${msg.sender} (to ${msg.receiver}): ${msg.message}`;
                messageElement.classList.add('message-received');
            }
            messageList.appendChild(messageElement);
        }
        scrollToBottom(messageList); // Auto-scroll
    });

});
