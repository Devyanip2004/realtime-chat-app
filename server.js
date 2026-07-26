const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Track active users: { socketId: { username, room } }
const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // 1. User joins
  socket.on('user-joined', (username) => {
    users[socket.id] = { username, room: 'General' };
    socket.join('General');

    // Notify only General room
    io.to('General').emit('chat-message', {
      senderId: 'system',
      name: 'System',
      message: `${username} joined General`,
      time: getCurrentTime(),
      target: 'General',
      isSystem: true
    });

    broadcastUsersList();
  });

  // 2. Room Switch
  socket.on('join-room', (newRoom) => {
    const user = users[socket.id];
    if (!user) return;

    socket.leave(user.room);
    user.room = newRoom;
    socket.join(newRoom);

    io.to(newRoom).emit('chat-message', {
      senderId: 'system',
      name: 'System',
      message: `${user.username} joined ${newRoom}`,
      time: getCurrentTime(),
      target: newRoom,
      isSystem: true
    });

    broadcastUsersList();
  });

  // 3. Message Send
  socket.on('send-chat-message', ({ target, message, isPrivate }) => {
    const sender = users[socket.id];
    if (!sender) return;

    const payload = {
      senderId: socket.id,
      name: sender.username,
      message,
      time: getCurrentTime(),
      target,
      isPrivate
    };

    if (isPrivate) {
      // Send to recipient
      io.to(target).emit('private-message', payload);
      // Echo back to sender
      socket.emit('private-message', payload);
    } else {
      // Broadcast to group room
      io.to(target).emit('chat-message', payload);
    }
  });

  // 4. Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      io.to(user.room).emit('chat-message', {
        senderId: 'system',
        name: 'System',
        message: `${user.username} left the chat`,
        time: getCurrentTime(),
        target: user.room,
        isSystem: true
      });
      delete users[socket.id];
      broadcastUsersList();
    }
  });

  function broadcastUsersList() {
    const userList = Object.keys(users).map((id) => ({
      id,
      username: users[id].username,
      room: users[id].room
    }));
    io.emit('update-users', userList);
  }
});

function getCurrentTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});