const express = require('express');
const { body, validationResult } = require('express-validator');
const NotificationPreference = require('../models/NotificationPreference.model');
const { authenticate } = require('../middleware/auth.middleware');
const { getClient } = require('../config/redis');

const router = express.Router();

// Get user notification preferences
router.get('/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let preferences = await NotificationPreference.findOne({ userId });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId });
    }

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to get preferences' });
  }
});

// Update notification preferences
router.put('/:userId', authenticate, [
  body('preferences').optional().isObject(),
  body('globalMute').optional().isBoolean(),
  body('quietHoursEnabled').optional().isBoolean(),
  body('quietHoursStart').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('quietHoursEnd').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let preferences = await NotificationPreference.findOne({ userId });

    if (!preferences) {
      preferences = new NotificationPreference({ userId });
    }

    // Update preferences
    if (req.body.preferences) {
      preferences.preferences = { ...preferences.preferences, ...req.body.preferences };
    }
    if (req.body.globalMute !== undefined) {
      preferences.globalMute = req.body.globalMute;
    }
    if (req.body.quietHoursEnabled !== undefined) {
      preferences.quietHoursEnabled = req.body.quietHoursEnabled;
    }
    if (req.body.quietHoursStart) {
      preferences.quietHoursStart = req.body.quietHoursStart;
    }
    if (req.body.quietHoursEnd) {
      preferences.quietHoursEnd = req.body.quietHoursEnd;
    }

    await preferences.save();

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notification_prefs:${userId}`);

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
});

// Update specific notification type preference
router.put('/:userId/type/:notificationType', authenticate, [
  body('inApp').optional().isBoolean(),
  body('email').optional().isBoolean(),
  body('sms').optional().isBoolean(),
  body('push').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { userId, notificationType } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    let preferences = await NotificationPreference.findOne({ userId });

    if (!preferences) {
      preferences = new NotificationPreference({ userId });
    }

    // Update specific notification type
    if (!preferences.preferences[notificationType]) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid notification type' 
      });
    }

    if (req.body.inApp !== undefined) {
      preferences.preferences[notificationType].inApp = req.body.inApp;
    }
    if (req.body.email !== undefined) {
      preferences.preferences[notificationType].email = req.body.email;
    }
    if (req.body.sms !== undefined) {
      preferences.preferences[notificationType].sms = req.body.sms;
    }
    if (req.body.push !== undefined) {
      preferences.preferences[notificationType].push = req.body.push;
    }

    preferences.markModified('preferences');
    await preferences.save();

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notification_prefs:${userId}`);

    res.json({ success: true, preferences });
  } catch (error) {
    console.error('Update notification type preference error:', error);
    res.status(500).json({ success: false, message: 'Failed to update preference' });
  }
});

// Reset preferences to default
router.post('/:userId/reset', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Delete existing preferences
    await NotificationPreference.deleteOne({ userId });

    // Create new default preferences
    const preferences = await NotificationPreference.create({ userId });

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notification_prefs:${userId}`);

    res.json({ 
      success: true, 
      message: 'Preferences reset to default',
      preferences 
    });
  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset preferences' });
  }
});

module.exports = router;
