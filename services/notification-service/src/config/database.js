const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.NOTIFICATION_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_notifications';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Notification Service)');
  } catch (err) {
    console.error('MongoDB connection error (Notification Service):', err);
    throw err;
  }
};
