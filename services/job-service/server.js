require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const connectRabbitMQ = require('./src/config/rabbitmq');
const jobRoutes = require('./src/routes/job.routes');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'job-service', timestamp: new Date().toISOString() });
});

app.use('/api/jobs', jobRoutes);

app.use((err, req, res, next) => {
  console.error('Job Service Error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

(async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();

    app.listen(PORT, () => console.log(`🚀 Job Service running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to start Job Service:', e);
    process.exit(1);
  }
})();
