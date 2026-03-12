require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const { connectRabbitMQ } = require('./src/config/rabbitmq');
const messageRoutes = require('./src/routes/message.routes');
const socketHandler = require('./src/sockets/messageSocket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:8080",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3009;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.MESSAGE_UPLOAD_DIR || path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.set('uploadDir', uploadDir);
app.set('io', io);

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'messaging-service', timestamp: new Date().toISOString() }));

app.use('/api/messages', (req, res, next) => { 
  req.uploadDir = uploadDir; 
  req.io = io;
  next(); 
}, messageRoutes);

app.use((err, req, res, next) => {
  console.error('Messaging Service Error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Socket.io connection handling
socketHandler(io);

(async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    server.listen(PORT, () => console.log(`🚀 Messaging Service running on port ${PORT} with Socket.io`));
  } catch (e) {
    console.error('Failed to start Messaging Service:', e);
    process.exit(1);
  }
})();
