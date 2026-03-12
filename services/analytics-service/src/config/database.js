const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.ANALYTICS_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_analytics';
  try {
    await mongoose.connect(uri);
    console.log('MongoDB connected (Analytics Service)');
  } catch (err) {
    console.error('MongoDB connection error (Analytics Service):', err);
    throw err;
  }
};
