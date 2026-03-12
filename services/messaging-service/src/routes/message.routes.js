const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, query, param, validationResult } = require('express-validator');
const Conversation = require('../models/Conversation.model');
const Message = require('../models/Message.model');
const { publishEvent } = require('../config/rabbitmq');
const axios = require('axios');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, req.uploadDir || 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type'));
  }
});

// Helper function to fetch user details
async function fetchUserDetails(userId) {
  try {
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    const response = await axios.get(`${userServiceUrl}/api/users/profile/${userId}`);
    if (response.data && response.data.user) {
      return {
        userId: response.data.user._id,
        name: response.data.user.name,
        userType: response.data.user.userType,
        avatar: response.data.user.profile?.avatar || null
      };
    }
  } catch (error) {
    console.error('Error fetching user details:', error.message);
  }
  return { userId, name: 'Unknown User', userType: 'unknown', avatar: null };
}

// Create or get conversation
router.post('/conversations', [
  body('participantId').isString().notEmpty(),
  body('jobId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const currentUserId = req.body.userId || req.headers['x-user-id'];
    const { participantId, jobId } = req.body;

    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'User ID required' });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, participantId] }
    });

    if (!conversation) {
      // Fetch user details for both participants
      const [user1Details, user2Details] = await Promise.all([
        fetchUserDetails(currentUserId),
        fetchUserDetails(participantId)
      ]);

      conversation = await Conversation.create({
        participants: [currentUserId, participantId],
        participantDetails: [user1Details, user2Details],
        jobId: jobId || null,
        unreadCount: { [currentUserId]: 0, [participantId]: 0 }
      });
    }

    res.status(201).json({ success: true, conversation });
  } catch (e) {
    console.error('Create conversation error:', e);
    res.status(500).json({ success: false, message: 'Failed to create conversation' });
  }
});

// Get conversations for user
router.get('/conversations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const conversations = await Conversation.find({ 
      participants: userId 
    })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Get unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          recipientId: userId,
          read: false
        });
        
        return {
          ...conv.toObject(),
          unreadCount
        };
      })
    );

    res.json({ 
      success: true, 
      conversations: conversationsWithUnread,
      page: parseInt(page),
      hasMore: conversations.length === parseInt(limit)
    });
  } catch (e) {
    console.error('Get conversations error:', e);
    res.status(500).json({ success: false, message: 'Failed to get conversations' });
  }
});

// Get messages for a conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ 
      success: true, 
      messages: messages.reverse(),
      page: parseInt(page),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (e) {
    console.error('Get messages error:', e);
    res.status(500).json({ success: false, message: 'Failed to get messages' });
  }
});

// Send a message (HTTP fallback)
router.post('/send', [
  body('conversationId').isString().notEmpty(),
  body('senderId').isString().notEmpty(),
  body('recipientId').isString().notEmpty(),
  body('text').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { conversationId, senderId, recipientId, text, attachmentUrl } = req.body;

    const message = await Message.create({
      conversationId,
      senderId,
      recipientId,
      text: text || '',
      attachmentUrl: attachmentUrl || ''
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageAt: new Date(),
      lastMessage: {
        text: text || 'Sent an attachment',
        senderId,
        createdAt: new Date()
      }
    });

    // Emit via Socket.io if available
    if (req.io) {
      req.io.to(`conversation:${conversationId}`).emit('message:new', message);
    }

    await publishEvent('message.sent', {
      conversationId,
      messageId: message._id,
      senderId,
      recipientId
    });

    res.status(201).json({ success: true, message });
  } catch (e) {
    console.error('Send message error:', e);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Upload attachment
router.post('/attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const url = `/uploads/${req.file.filename}`;
    
    res.status(201).json({ 
      success: true, 
      url,
      filename: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size
    });
  } catch (e) {
    console.error('Upload attachment error:', e);
    res.status(500).json({ success: false, message: 'Failed to upload attachment' });
  }
});

// Mark message as read
router.put('/:messageId/read', async (req, res) => {
  try {
    const message = await Message.findByIdAndUpdate(
      req.params.messageId,
      { read: true, readAt: new Date() },
      { new: true }
    );
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    await publishEvent('message.read', {
      messageId: message._id,
      conversationId: message.conversationId
    });

    res.json({ success: true, message });
  } catch (e) {
    console.error('Mark as read error:', e);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

// Mark all messages in conversation as read
router.put('/conversation/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User ID required' });
    }

    const result = await Message.updateMany(
      { conversationId, recipientId: userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ 
      success: true, 
      updatedCount: result.modifiedCount 
    });
  } catch (e) {
    console.error('Mark conversation as read error:', e);
    res.status(500).json({ success: false, message: 'Failed to mark conversation as read' });
  }
});

// Get unread message count
router.get('/unread/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const count = await Message.countDocuments({
      recipientId: userId,
      read: false
    });

    res.json({ success: true, unreadCount: count });
  } catch (e) {
    console.error('Get unread count error:', e);
    res.status(500).json({ success: false, message: 'Failed to get unread count' });
  }
});

// Search messages
router.get('/search', async (req, res) => {
  try {
    const { userId, q = '', page = 1, limit = 20 } = req.query;
    
    if (!userId || !q) {
      return res.status(400).json({ success: false, message: 'userId and q are required' });
    }

    const skip = (page - 1) * limit;
    
    const conversations = await Conversation.find({ participants: userId }).select('_id');
    const convIds = conversations.map(c => c._id);
    
    const messages = await Message.find({
      conversationId: { $in: convIds },
      text: new RegExp(String(q), 'i')
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    res.json({ 
      success: true, 
      results: messages,
      page: parseInt(page),
      hasMore: messages.length === parseInt(limit)
    });
  } catch (e) {
    console.error('Search error:', e);
    res.status(500).json({ success: false, message: 'Failed to search' });
  }
});

// Delete message
router.delete('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'];

    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Only sender can delete their message
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await message.deleteOne();

    // Emit via Socket.io if available
    if (req.io) {
      req.io.to(`conversation:${message.conversationId}`).emit('message:deleted', { messageId });
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (e) {
    console.error('Delete message error:', e);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

module.exports = router;
