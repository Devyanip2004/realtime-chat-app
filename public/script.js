const socket = io();

const joinContainer = document.getElementById('join-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');

const messageContainer = document.getElementById('message-container');
const sendForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');
const roomsList = document.getElementById('rooms-list');
const usersList = document.getElementById('users-list');
const chatTitle = document.getElementById('current-chat-title');

let myUsername = '';
let activeTarget = 'General'; // Current room or user socket ID
let isPrivateChat = false;

// Store history per chat target: { [targetId]: [ { name, message, time, type } ] }
const chatHistory = {
  General: [],
  Tech: [],
  Random: []
};

joinBtn.addEventListener('click', () => {
  myUsername = usernameInput.value.trim();
  if (myUsername) {
    joinContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    socket.emit('user-joined', myUsername);
  }
});

// Switch Group Rooms
roomsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('room-item')) {
    const room = e.target.dataset.room;
    if (activeTarget === room) return;

    setActiveItem(e.target);
    activeTarget = room;
    isPrivateChat = false;
    chatTitle.innerText = `# ${room}`;

    if (!chatHistory[room]) chatHistory[room] = [];
    socket.emit('join-room', room);
    renderMessages(room);
  }
});

// Send Message
sendForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('send-chat-message', {
      target: activeTarget,
      message,
      isPrivate: isPrivateChat
    });
    messageInput.value = '';
  }
});

// Handle Group & System Messages
socket.on('chat-message', (data) => {
  const room = data.target;
  if (!chatHistory[room]) chatHistory[room] = [];

  const msgObj = {
    name: data.name,
    message: data.message,
    time: data.time,
    type: data.isSystem ? 'system' : (data.senderId === socket.id ? 'user' : 'other')
  };

  chatHistory[room].push(msgObj);

  // Render if currently looking at this room
  if (!isPrivateChat && activeTarget === room) {
    renderMessages(room);
  }
});

// Handle Direct Messages
socket.on('private-message', (data) => {
  const isSelf = data.senderId === socket.id;
  const chatKey = isSelf ? data.target : data.senderId;

  if (!chatHistory[chatKey]) chatHistory[chatKey] = [];

  chatHistory[chatKey].push({
    name: data.name,
    message: data.message,
    time: data.time,
    type: isSelf ? 'user' : 'other'
  });

  // If sender is currently looking at this chat, render immediately
  if (isPrivateChat && activeTarget === chatKey) {
    renderMessages(chatKey);
  } else if (!isSelf) {
    // Show red dot indicator on sidebar for unread message
    const userLi = document.querySelector(`li[data-id="${data.senderId}"]`);
    if (userLi && !userLi.innerText.includes('🔴')) {
      userLi.innerText += ' 🔴';
    }
  }
});

// Update Online Users List
socket.on('update-users', (users) => {
  usersList.innerHTML = '';
  users.forEach((u) => {
    if (u.id === socket.id) return; // Hide self

    const li = document.createElement('li');
    li.innerText = `👤 ${u.username}`;
    li.dataset.id = u.id;
    li.dataset.username = u.username;

    if (isPrivateChat && activeTarget === u.id) {
      li.classList.add('active');
    }

    li.addEventListener('click', () => {
      setActiveItem(li);
      activeTarget = u.id;
      isPrivateChat = true;
      chatTitle.innerText = `💬 Direct Message: ${u.username}`;

      // Remove unread dot when clicked
      li.innerText = `👤 ${u.username}`;

      if (!chatHistory[u.id]) chatHistory[u.id] = [];
      renderMessages(u.id);
    });

    usersList.appendChild(li);
  });
});

function setActiveItem(selectedEl) {
  document.querySelectorAll('.sidebar li').forEach(el => el.classList.remove('active'));
  selectedEl.classList.add('active');
}

function renderMessages(targetKey) {
  messageContainer.innerHTML = '';
  const history = chatHistory[targetKey] || [];

  history.forEach((msg) => {
    const div = document.createElement('div');
    div.classList.add('message', msg.type);
    if (msg.type === 'system') {
      div.innerText = msg.message;
    } else {
      div.innerHTML = `<strong>${msg.type === 'user' ? 'You' : msg.name}</strong> <small style="font-size:0.7em; color:#666;">${msg.time}</small><br>${msg.message}`;
    }
    messageContainer.appendChild(div);
  });

  messageContainer.scrollTop = messageContainer.scrollHeight;
}