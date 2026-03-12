const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  type: { 
    type: String, 
    required: true,
    enum: [
      'application_created',
      'application_status',
      'job_created',
      'job_updated',
      'match_found',
      'recommendation',
      'message_received',
      'interview_scheduled',
      'interview_reminder',
      'interview_rescheduled',
      'interview_cancelled',
      'cv_processed',
      'cv_suggestions',
      'payment_processed',
      'subscription_created',
      'subscription_cancelled',
      'review_received',
      'system',
      'other'
    ],
    index: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  meta: { type: Object, default: {} },
  read: { type: Boolean, default: false, index: true },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  actionUrl: { type: String, default: '' },
  actionText: { type: String, default: '' },
  expiresAt: { type: Date, default: null }
}, { timestamps: true });

// Compound index for efficient queries
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Auto-delete expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);
