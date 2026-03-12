const mongoose = require('mongoose');

module.exports = async function connectDB() {
  const uri = process.env.DB_URL || process.env.PAYMENT_SERVICE_DB_URL || 'mongodb://localhost:27017/hirebridge_payments';
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected (Payment Service)');
  } catch (err) {
    console.error('MongoDB connection error (Payment Service):', err);
    throw err;
  }
};
