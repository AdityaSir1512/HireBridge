const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.INTERVIEW_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_interviews';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Interview Service)');
  } catch (err) {
    console.error('MongoDB connection error (Interview Service):', err);
    throw err;
  }
};
