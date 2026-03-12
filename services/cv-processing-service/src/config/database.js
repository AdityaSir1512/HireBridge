const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.CV_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_cv';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (CV Service)');
  } catch (err) {
    console.error('MongoDB connection error (CV Service):', err);
    throw err;
  }
};
