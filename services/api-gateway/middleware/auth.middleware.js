const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  console.log('🔐 AuthenticateToken called for path:', req.path, 'originalUrl:', req.originalUrl, 'method:', req.method);
  console.log('🔐 Stack trace:', new Error().stack.split('\n').slice(1, 4).join('\n'));
  try {
    // Skip authentication for public routes
    // Note: req.path doesn't include the mount point, so '/api' is stripped
    const publicRoutes = ['/users/register', '/users/login', '/health', '/api/users/register', '/api/users/login', '/chatbot'];
    if (publicRoutes.some(route => req.path.startsWith(route) || req.originalUrl.startsWith(route))) {
      console.log('✅ Skipping auth for public route');
      return next();
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    
    // Check Redis for token blacklist
    const redisClient = getRedisClient();
    const isBlacklisted = await redisClient.get(`token:blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked'
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

// Validate user type middleware
const validateUserType = (allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Optional authentication middleware (allows both authenticated and guest users)
const optionalAuth = async (req, res, next) => {
  console.log('OptionalAuth called for:', req.path);
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      console.log('Token found, attempting to verify');
      
      // Check Redis for token blacklist
      const redisClient = getRedisClient();
      const isBlacklisted = await redisClient.get(`token:blacklist:${token}`);
      if (!isBlacklisted) {
        try {
          const decoded = verifyToken(token);
          req.user = decoded;
          console.log('Token verified, user:', decoded.userId);
        } catch (error) {
          // Invalid token, but continue as guest
          console.log('Invalid token, continuing as guest:', error.message);
        }
      }
    } else {
      console.log('No token provided, continuing as guest');
    }
    
    // Continue regardless of authentication status
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // Continue on error
  }
};

// Rate limiting per user
const userRateLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const redisClient = getRedisClient();
    const key = `ratelimit:user:${req.user.userId}`;
    const requests = await redisClient.incr(key);
    
    if (requests === 1) {
      await redisClient.expire(key, 60); // 1 minute window
    }

    if (requests > 100) { // 100 requests per minute per user
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later'
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    next(); // Continue on error
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
  validateUserType,
  userRateLimit,
  verifyToken
};

