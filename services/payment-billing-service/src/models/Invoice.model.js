const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  description: { type: String, default: '' },
  stripeInvoiceId: { type: String, default: '' },
  status: { type: String, enum: ['paid','open','void','uncollectible'], default: 'open' }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);
