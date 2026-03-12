require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const { connectRabbitMQ, startConsumers } = require('./src/config/rabbitmq');
const routes = require('./src/routes/analytics.routes');

const app = express();
const PORT = process.env.PORT || 3015;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'analytics-service', timestamp: new Date().toISOString() }));

app.use('/api/analytics', routes);

app.use((err, req, res, next) => {
  console.error('Analytics Service Error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

(async () => {
  try {
    await connectDB();
    await connectRedis();
    const channel = await connectRabbitMQ();
    await startConsumers(channel);
    app.listen(PORT, () => console.log(`🚀 Analytics Service running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to start Analytics Service:', e);
    process.exit(1);
  }
})();
