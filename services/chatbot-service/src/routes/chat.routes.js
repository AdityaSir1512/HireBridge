const express = require('express');
const { getClient } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { detectIntent, buildResponse } = require('../services/intent');

const router = express.Router();

// Send message to chatbot
router.post('/message', async (req, res) => {
  try {
    const { message, userId, userType } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'message is required' });

    const intent = detectIntent(message);
    const finalUserType = userType || 'guest';
    const reply = buildResponse(intent, finalUserType);
    const sessionId = userId || `guest_${Date.now()}`;

    // Save to history (Redis list) - only for registered users or limit guest history
    try {
      const redis = getClient();
      const key = `chatbot:history:${sessionId}`;
      const entry = { role: 'user', message, ts: Date.now() };
      const botEntry = { role: 'bot', message: reply.text, link: reply.link, ts: Date.now() };
      
      await redis.lPush(key, JSON.stringify(botEntry));
      await redis.lPush(key, JSON.stringify(entry));
      await redis.lTrim(key, 0, userId ? 99 : 20); // Limit guest history to 20 messages
      
      // Set expiry for guest sessions (1 hour)
      if (!userId) {
        await redis.expire(key, 3600);
      }
    } catch (redisError) {
      console.log('Redis save failed, continuing without history:', redisError.message);
    }

    // Publish event for analytics
    try {
      await publishEvent('chatbot.message.received', { userId: sessionId, intent, userType: finalUserType, timestamp: Date.now() });
    } catch (pubError) {
      console.log('Event publish failed:', pubError.message);
    }

    res.json({ success: true, reply, intent, userType: finalUserType });
  } catch (e) {
    console.error('Chatbot message error:', e);
    res.status(500).json({ success: false, message: 'I\'m having trouble right now. Please try again in a moment.' });
  }
});

// Get conversation history
router.get('/history/:userId', async (req, res) => {
  try {
    const redis = getClient();
    const key = `chatbot:history:${req.params.userId}`;
    const list = await redis.lRange(key, 0, 99);
    const history = list.map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    }).filter(Boolean).reverse();
    
    res.json({ success: true, history, count: history.length });
  } catch (e) {
    console.error('Chatbot history error:', e);
    res.status(500).json({ success: true, history: [], message: 'History temporarily unavailable' });
  }
});

// Clear conversation history
router.delete('/history/:userId', async (req, res) => {
  try {
    const redis = getClient();
    const key = `chatbot:history:${req.params.userId}`;
    await redis.del(key);
    res.json({ success: true, message: 'History cleared' });
  } catch (e) {
    console.error('Chatbot clear history error:', e);
    res.status(500).json({ success: false, message: 'Failed to clear history' });
  }
});

// Get suggestions based on user context
router.get('/suggestions/:userType?', (req, res) => {
  try {
    const userType = req.params.userType || 'guest';
    const suggestions = {
      guest: [
        { text: "How to register?", query: "how do I register" },
        { text: "Browse jobs", query: "how to search for jobs" },
        { text: "About HireBridge", query: "what is HireBridge" },
        { text: "Platform features", query: "what features does HireBridge have" }
      ],
      job_seeker: [
        { text: "Upload CV", query: "how to upload my CV" },
        { text: "Find jobs", query: "where can I find jobs" },
        { text: "My applications", query: "where are my applications" },
        { text: "Profile help", query: "how to edit my profile" },
        { text: "Saved jobs", query: "where are my saved jobs" }
      ],
      employer: [
        { text: "Post a job", query: "how to post a job" },
        { text: "View applications", query: "where are job applications" },
        { text: "Find candidates", query: "how to find candidates" },
        { text: "Company profile", query: "edit company profile" },
        { text: "Manage jobs", query: "how to manage job postings" }
      ]
    };
    
    res.json({ success: true, suggestions: suggestions[userType] || suggestions.guest });
  } catch (e) {
    console.error('Chatbot suggestions error:', e);
    res.status(500).json({ success: false, message: 'Failed to get suggestions' });
  }
});

// Feedback endpoint
router.post('/feedback', async (req, res) => {
  try {
    const { userId, helpful, message } = req.body;
    await publishEvent('chatbot.feedback', { userId, helpful: !!helpful, message, ts: Date.now() });
    res.json({ success: true, message: 'Thank you for your feedback!' });
  } catch (e) {
    console.error('Chatbot feedback error:', e);
    res.status(500).json({ success: false, message: 'Failed to record feedback' });
  }
});

module.exports = router;
