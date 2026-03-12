const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  exchange: { type: String, required: true },
  routingKey: { type: String, required: true },
  payload: { type: Object, required: true },
  ts: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Event', eventSchema);
