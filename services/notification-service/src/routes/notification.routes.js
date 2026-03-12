const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Notification = require('../models/Notification.model');
const { authenticate } = require('../middleware/auth.middleware');
const { getClient } = require('../config/redis');
const { notifyUser } = require('../services/websocket');

const router = express.Router();

// Create notification (internal/admin use)
router.post('/', [
  body('userId').isString().notEmpty(),
  body('type').isString().notEmpty(),
  body('title').isString().notEmpty(),
  body('message').isString().notEmpty(),
  body('meta').optional().isObject(),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    
    const notif = await Notification.create({
      userId: req.body.userId,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      meta: req.body.meta || {},
      priority: req.body.priority || 'normal'
    });

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notifications:${req.body.userId}`);
    await redis.del(`unread_count:${req.body.userId}`);

    // Send real-time notification via WebSocket
    notifyUser(req.body.userId, notif);

    res.status(201).json({ success: true, notification: notif });
  } catch (e) {
    console.error('Create notification error:', e);
    res.status(500).json({ success: false, message: 'Failed to create notification' });
  }
});

// Batch create notifications
router.post('/batch', [
  body('notifications').isArray().notEmpty(),
  body('notifications.*.userId').isString().notEmpty(),
  body('notifications.*.type').isString().notEmpty(),
  body('notifications.*.title').isString().notEmpty(),
  body('notifications.*.message').isString().notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const notifs = await Notification.insertMany(req.body.notifications);

    // Invalidate caches and send real-time notifications
    const redis = getClient();
    const userIds = [...new Set(req.body.notifications.map(n => n.userId))];
    for (const userId of userIds) {
      await redis.del(`notifications:${userId}`);
      await redis.del(`unread_count:${userId}`);
    }

    // Send real-time notifications
    notifs.forEach(notif => {
      notifyUser(notif.userId.toString(), notif);
    });

    res.status(201).json({ success: true, count: notifs.length, notifications: notifs });
  } catch (e) {
    console.error('Batch create notifications error:', e);
    res.status(500).json({ success: false, message: 'Failed to create notifications' });
  }
});

// Get notifications for user (with pagination and filtering)
router.get('/:userId', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isString(),
  query('read').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Check if user is requesting their own notifications
    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Build query
    const query = { userId };
    if (req.query.type) query.type = req.query.type;
    if (req.query.read !== undefined) query.read = req.query.read === 'true';

    // Try cache first
    const redis = getClient();
    const cacheKey = `notifications:${userId}:${page}:${limit}:${req.query.type || 'all'}:${req.query.read || 'all'}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    const result = {
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };

    // Cache for 5 minutes
    await redis.setEx(cacheKey, 300, JSON.stringify(result));

    res.json(result);
  } catch (e) {
    console.error('Get notifications error:', e);
    res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
});

// Get unread count for user
router.get('/:userId/count/unread', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Try cache first
    const redis = getClient();
    const cacheKey = `unread_count:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json({ success: true, count: parseInt(cached) });
    }

    const count = await Notification.countDocuments({ userId, read: false });

    // Cache for 2 minutes
    await redis.setEx(cacheKey, 120, count.toString());

    res.json({ success: true, count });
  } catch (e) {
    console.error('Get unread count error:', e);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticate, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.notificationId);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

    // Check ownership
    if (notif.userId.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    notif.read = true;
    await notif.save();

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notifications:${notif.userId}`);
    await redis.del(`unread_count:${notif.userId}`);

    res.json({ success: true, notification: notif });
  } catch (e) {
    console.error('Mark read error:', e);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

// Mark all notifications as read for user
router.put('/:userId/read-all', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await Notification.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notifications:${userId}`);
    await redis.del(`unread_count:${userId}`);

    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (e) {
    console.error('Mark all read error:', e);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

// Delete notification
router.delete('/:notificationId', authenticate, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.notificationId);
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

    // Check ownership
    if (notif.userId.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await notif.deleteOne();

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notifications:${notif.userId}`);
    await redis.del(`unread_count:${notif.userId}`);

    res.json({ success: true, message: 'Notification deleted' });
  } catch (e) {
    console.error('Delete notification error:', e);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

// Delete all read notifications for user
router.delete('/:userId/clear-read', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await Notification.deleteMany({ userId, read: true });

    // Invalidate cache
    const redis = getClient();
    await redis.del(`notifications:${userId}`);

    res.json({ 
      success: true, 
      message: 'Read notifications cleared',
      deletedCount: result.deletedCount
    });
  } catch (e) {
    console.error('Clear read notifications error:', e);
    res.status(500).json({ success: false, message: 'Failed to clear notifications' });
  }
});

module.exports = router;
