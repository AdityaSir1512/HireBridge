require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const connectDB = require('./src/config/database');
const connectRedis = require('./src/config/redis');
const { connectRabbitMQ } = require('./src/config/rabbitmq');
const cvRoutes = require('./src/routes/cv.routes');

const app = express();
const PORT = process.env.PORT || 3006;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure storage directory exists
const storageDir = process.env.FILE_STORAGE_PATH || path.join(__dirname, 'uploads', 'cv');
fs.mkdirSync(storageDir, { recursive: true });
app.set('cvStorageDir', storageDir);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok', service: 'cv-processing-service', timestamp: new Date().toISOString() }));

app.use('/api/cv', (req, res, next) => { req.cvStorageDir = storageDir; next(); }, cvRoutes);

app.use((err, req, res, next) => {
  console.error('CV Service Error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

(async () => {
  try {
    await connectDB();
    await connectRedis();
    await connectRabbitMQ();
    app.listen(PORT, () => console.log(`🚀 CV Processing Service running on port ${PORT}`));
  } catch (e) {
    console.error('Failed to start CV Processing Service:', e);
    process.exit(1);
  }
})();
