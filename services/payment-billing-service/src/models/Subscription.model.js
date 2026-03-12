const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  plan: { type: String, enum: ['basic','pro','enterprise'], required: true },
  status: { type: String, enum: ['active','canceled','past_due'], default: 'active' },
  stripeCustomerId: { type: String, default: '' },
  stripeSubscriptionId: { type: String, default: '' },
  startedAt: { type: Date, default: Date.now },
  endsAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Subscription', subscriptionSchema);
