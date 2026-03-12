const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.JOB_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_jobs';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Job Service)');
  } catch (err) {
    console.error('MongoDB connection error (Job Service):', err);
    throw err;
  }
};
