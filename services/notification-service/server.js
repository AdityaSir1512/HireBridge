require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const { connectRabbitMQ, startConsumers } = require('./src/config/rabbitmq');
const notificationRoutes = require('./src/routes/notification.routes');
const preferenceRoutes = require('./src/routes/preference.routes');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.status(200).json({ 
  status: 'ok', 
  service: 'notification-service', 
  timestamp: new Date().toISOString() 
}));

app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-preferences', preferenceRoutes);

app.use((err, req, res, next) => {
  console.error('Notification Service Error:', err);
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error' 
  });
});

app.use((req, res) => res.status(404).json({ 
  success: false, 
  message: 'Route not found' 
}));

(async () => {
  try {
    await connectDB();
    console.log('✅ MongoDB connected');
    
    await connectRedis();
    console.log('✅ Redis connected');
    
    const channel = await connectRabbitMQ();
    console.log('✅ RabbitMQ connected');
    
    await startConsumers(channel);

    app.listen(PORT, () => console.log(`🚀 Notification Service running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to start Notification Service:', e);
    process.exit(1);
  }
})();
