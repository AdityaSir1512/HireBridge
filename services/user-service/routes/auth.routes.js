const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User.model');
const { generateToken, authenticate } = require('../middleware/auth.middleware');
const { publishEvent } = require('../config/rabbitmq');
const { getRedisClient } = require('../config/redis');

// Register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('userType').isIn(['job_seeker', 'employer']).withMessage('Invalid user type'),
  body('jobTypePreference').optional().isIn(['freelancer', 'full_time', 'internship']),
  body('employerType').optional().isIn(['company', 'personal'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password, userType, jobTypePreference, employerType } = req.body;

    // Validate job seeker has jobTypePreference
    if (userType === 'job_seeker' && !jobTypePreference) {
      return res.status(400).json({
        success: false,
        message: 'Job type preference is required for job seekers'
      });
    }

    // Validate employer has employerType
    if (userType === 'employer' && !employerType) {
      return res.status(400).json({
        success: false,
        message: 'Employer type is required for employers'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create user
    const userData = {
      name,
      email,
      password,
      userType,
      jobTypePreference: userType === 'job_seeker' ? jobTypePreference : null,
      employerType: userType === 'employer' ? employerType : null
    };

    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.userType);

    // Publish user.created event
    await publishEvent('user_events', 'user.created', {
      userId: user._id,
      userType: user.userType,
      email: user.email
    });

    // Cache user data in Redis
    const redisClient = getRedisClient();
    await redisClient.setEx(`user:${user._id}`, 3600, JSON.stringify(user.toPublicJSON()));

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id, user.userType);

    // Cache user data in Redis
    const redisClient = getRedisClient();
    await redisClient.setEx(`user:${user._id}`, 3600, JSON.stringify(user.toPublicJSON()));

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

module.exports = router;

