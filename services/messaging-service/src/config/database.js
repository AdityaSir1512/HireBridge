const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.MESSAGING_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_messaging';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Messaging Service)');
  } catch (err) {
    console.error('MongoDB connection error (Messaging Service):', err);
    throw err;
  }
};
