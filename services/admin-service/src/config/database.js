const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.ADMIN_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_admin';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Admin Service)');
  } catch (err) {
    console.error('MongoDB connection error (Admin Service):', err);
    throw err;
  }
};
