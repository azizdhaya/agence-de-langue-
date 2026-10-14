require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

// Single source of truth for the Express app (middleware + routes + error
// handling). server.js only adds the HTTP server, Socket.io and listen.
const app = require('./app');

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Socket.io for real-time messaging. Authenticated like the REST API: the
// handshake carries the same Bearer token, so a client can neither join
// another user's room nor send as someone else.
const jwt = require('jsonwebtoken');
io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = payload.id;
    socket.userRole = payload.role;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_room', () => {
    // The room is always the authenticated user's own: the client-supplied id
    // is ignored so nobody can listen to someone else's messages.
    socket.join(`user_${socket.userId}`);
  });

  socket.on('send_message', (data) => {
    io.to(`user_${data.receiverId}`).emit('receive_message', {
      ...data,
      senderId: socket.userId
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for real-time communication`);
  console.log(`🔒 Security: Helmet + Rate Limiting enabled`);
});
