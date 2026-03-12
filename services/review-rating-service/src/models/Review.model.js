const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, default: '' },
  categories: [{ type: String }],
  helpfulCount: { type: Number, default: 0 },
  reported: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
