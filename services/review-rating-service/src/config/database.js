const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.REVIEW_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_reviews';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Review Service)');
  } catch (err) {
    console.error('MongoDB connection error (Review Service):', err);
    throw err;
  }
};
