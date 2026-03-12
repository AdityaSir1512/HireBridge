const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, required: true, index: true }],
  participantDetails: [{
    userId: mongoose.Schema.Types.ObjectId,
    name: String,
    userType: String,
    avatar: String
  }],
  jobId: { type: mongoose.Schema.Types.ObjectId, default: null },
  lastMessage: {
    text: String,
    senderId: mongoose.Schema.Types.ObjectId,
    createdAt: Date
  },
  lastMessageAt: { type: Date, default: Date.now },
  unreadCount: { type: Map, of: Number, default: {} }
}, { timestamps: true });

// Index for faster queries
conversationSchema.index({ participants: 1, lastMessageAt: -1 });
conversationSchema.index({ 'participants': 1, 'lastMessageAt': -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
