const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { authenticateToken, optionalAuth, validateUserType, userRateLimit } = require('../middleware/auth.middleware');

const router = express.Router();

// Service URLs
const SERVICES = {
  USER_SERVICE: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  JOB_SERVICE: process.env.JOB_SERVICE_URL || 'http://localhost:3002',
  MATCHING_SERVICE: process.env.MATCHING_SERVICE_URL || 'http://localhost:3003',
  APPLICATION_SERVICE: process.env.APPLICATION_SERVICE_URL || 'http://localhost:3004',
  NOTIFICATION_SERVICE: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  CV_SERVICE: process.env.CV_SERVICE_URL || 'http://localhost:3006',
  CHATBOT_SERVICE: process.env.CHATBOT_SERVICE_URL || 'http://localhost:3007',
  MESSAGING_SERVICE: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3009',
  INTERVIEW_SERVICE: process.env.INTERVIEW_SERVICE_URL || 'http://localhost:3011',
  REVIEW_SERVICE: process.env.REVIEW_SERVICE_URL || 'http://localhost:3013',
  PAYMENT_SERVICE: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3014',
  ANALYTICS_SERVICE: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3015',
  ADMIN_SERVICE: process.env.ADMIN_SERVICE_URL || 'http://localhost:3016'
};

// Proxy configuration
const createProxy = (target, pathRewrite = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: 30000,
    timeout: 30000,
    pathRewrite,
    onError: (err, req, res) => {
      console.error('Proxy error:', err);
      res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable'
      });
    },
    onProxyReq: (proxyReq, req) => {
      // Forward user info from JWT to service
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.userId);
        proxyReq.setHeader('X-User-Type', req.user.userType);
      }
      // If body was parsed by express.json(), re-send it to target
      if (req.body && Object.keys(req.body).length) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      // Normalize CORS coming back from services to avoid '*' with credentials
      delete proxyRes.headers['access-control-allow-origin'];
      delete proxyRes.headers['access-control-allow-credentials'];
      const origin = process.env.FRONTEND_URL || 'http://localhost:8080';
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }
  });
};

// Public auth routes (register/login) must be available without JWT
router.use('/users/register', createProxy(SERVICES.USER_SERVICE, {
  '^/users': '/api/users'
}));
router.use('/users/login', createProxy(SERVICES.USER_SERVICE, {
  '^/users': '/api/users'
}));

// Chatbot Service Routes (available to both authenticated and guest users)
router.use('/chatbot', optionalAuth, createProxy(SERVICES.CHATBOT_SERVICE, {
  '^/chatbot': '/api/chatbot'
}));

// User Service Routes (protected)
router.use('/users', authenticateToken, userRateLimit, createProxy(SERVICES.USER_SERVICE, {
  '^/users': '/api/users'
}));

// Job Service Routes (requires authentication)
router.use('/jobs', authenticateToken, userRateLimit, createProxy(SERVICES.JOB_SERVICE, {
  '^/jobs': '/api/jobs'
}));

// Matching Service Routes
router.use('/matching', authenticateToken, userRateLimit, createProxy(SERVICES.MATCHING_SERVICE, {
  '^/matching': '/api/matching'
}));

// Application Service Routes
router.use('/applications', authenticateToken, userRateLimit, createProxy(SERVICES.APPLICATION_SERVICE, {
  '^/applications': '/api/applications'
}));

// Notification Service Routes
router.use('/notifications', authenticateToken, userRateLimit, createProxy(SERVICES.NOTIFICATION_SERVICE, {
  '^/notifications': '/api/notifications'
}));

// Notification Preferences Routes
router.use('/notification-preferences', authenticateToken, userRateLimit, createProxy(SERVICES.NOTIFICATION_SERVICE, {
  '^/notification-preferences': '/api/notification-preferences'
}));

// CV Processing Service Routes (job seeker only for upload)
router.use('/cv', authenticateToken, userRateLimit, createProxy(SERVICES.CV_SERVICE, {
  '^/cv': '/api/cv'
}));

// Messaging Service Routes
router.use('/messages', authenticateToken, userRateLimit, createProxy(SERVICES.MESSAGING_SERVICE, {
  '^/messages': '/api/messages'
}));

// Interview Scheduling Service Routes
router.use('/interviews', authenticateToken, userRateLimit, createProxy(SERVICES.INTERVIEW_SERVICE, {
  '^/interviews': '/api/interviews'
}));

// Review & Rating Service Routes
router.use('/reviews', authenticateToken, userRateLimit, createProxy(SERVICES.REVIEW_SERVICE, {
  '^/reviews': '/api/reviews'
}));

// Payment & Billing Service Routes
router.use('/payments', authenticateToken, userRateLimit, createProxy(SERVICES.PAYMENT_SERVICE, {
  '^/payments': '/api/payments'
}));

// Analytics Service Routes
router.use('/analytics', authenticateToken, userRateLimit, createProxy(SERVICES.ANALYTICS_SERVICE, {
  '^/analytics': '/api/analytics'
}));

// Admin Service Routes (admin only)
router.use('/admin', authenticateToken, userRateLimit, validateUserType(['admin']), createProxy(SERVICES.ADMIN_SERVICE, {
  '^/admin': '/api/admin'
}));

module.exports = router;

