const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { publishEvent } = require('../config/rabbitmq');
const { getRedisClient } = require('../config/redis');

// Get user profile
router.get('/profile/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestUserId = req.user.userId;

    // Check if user is requesting their own profile or has permission
    if (userId !== requestUserId && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Try to get from cache first
    const redisClient = getRedisClient();
    const cachedUser = await redisClient.get(`user:${userId}`);
    
    if (cachedUser) {
      return res.json({
        success: true,
        user: JSON.parse(cachedUser)
      });
    }

    // Get from database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Cache user data
    await redisClient.setEx(`user:${userId}`, 3600, JSON.stringify(user.toPublicJSON()));

    res.json({
      success: true,
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
});

// Update user profile
router.put('/profile/:userId', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('jobTypePreference').optional().isIn(['freelancer', 'full_time', 'internship']),
  body('employerType').optional().isIn(['company', 'personal']),
  body('themePreference').optional().isIn(['light', 'dark', 'system'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const requestUserId = req.user.userId;

    // Check if user is updating their own profile
    if (userId !== requestUserId) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'profile', 'companyProfile', 'personalProfile', 'themePreference', 'settings'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });

    // Handle job type preference change
    if (req.body.jobTypePreference && req.body.jobTypePreference !== user.jobTypePreference) {
      updateData.jobTypePreference = req.body.jobTypePreference;
      // Publish preference changed event
      await publishEvent('user_events', 'user.preference.changed', {
        userId: user._id,
        oldPreference: user.jobTypePreference,
        newPreference: req.body.jobTypePreference
      });
    }

    // Handle employer type change
    if (req.body.employerType && req.body.employerType !== user.employerType) {
      updateData.employerType = req.body.employerType;
    }

    Object.assign(user, updateData);
    await user.save();

    // Invalidate cache
    const redisClient = getRedisClient();
    await redisClient.del(`user:${userId}`);

    // Publish user updated event
    await publishEvent('user_events', 'user.updated', {
      userId: user._id,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

// Update job type preference (job seeker only)
router.put('/job-seeker/:userId/job-preference', authenticate, authorize('job_seeker'), [
  body('jobTypePreference').isIn(['freelancer', 'full_time', 'internship']).withMessage('Invalid job type preference')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { jobTypePreference } = req.body;

    if (userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.userType !== 'job_seeker') {
      return res.status(404).json({
        success: false,
        message: 'Job seeker not found'
      });
    }

    const oldPreference = user.jobTypePreference;
    user.jobTypePreference = jobTypePreference;
    await user.save();

    // Invalidate cache
    const redisClient = getRedisClient();
    await redisClient.del(`user:${userId}`);

    // Publish preference changed event
    await publishEvent('user_events', 'user.preference.changed', {
      userId: user._id,
      oldPreference,
      newPreference: jobTypePreference
    });

    res.json({
      success: true,
      message: 'Job type preference updated',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update job preference error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job preference',
      error: error.message
    });
  }
});

// Update employer type
router.put('/employer/:userId/employer-type', authenticate, authorize('employer'), [
  body('employerType').isIn(['company', 'personal']).withMessage('Invalid employer type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { employerType } = req.body;

    if (userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    if (!user || user.userType !== 'employer') {
      return res.status(404).json({
        success: false,
        message: 'Employer not found'
      });
    }

    user.employerType = employerType;
    await user.save();

    // Invalidate cache
    const redisClient = getRedisClient();
    await redisClient.del(`user:${userId}`);

    res.json({
      success: true,
      message: 'Employer type updated',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Update employer type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update employer type',
      error: error.message
    });
  }
});

// Update theme preference
router.put('/:userId/theme-preference', authenticate, [
  body('theme').isIn(['light', 'dark', 'system']).withMessage('Invalid theme')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { theme } = req.body;

    if (userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.themePreference = theme;
    await user.save();

    // Invalidate cache
    const redisClient = getRedisClient();
    await redisClient.del(`user:${userId}`);

    res.json({
      success: true,
      message: 'Theme preference updated',
      themePreference: user.themePreference
    });
  } catch (error) {
    console.error('Update theme preference error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update theme preference',
      error: error.message
    });
  }
});

// Get job seekers (for employers to browse)
router.get('/job-seekers', authenticate, authorize('employer'), async (req, res) => {
  try {
    const { page = 1, limit = 20, jobTypePreference, skills } = req.query;
    const skip = (page - 1) * limit;

    const query = { userType: 'job_seeker', isActive: true };
    if (jobTypePreference) {
      query.jobTypePreference = jobTypePreference;
    }
    if (skills) {
      query['profile.skills'] = { $in: Array.isArray(skills) ? skills : [skills] };
    }

    const users = await User.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get job seekers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job seekers',
      error: error.message
    });
  }
});

// Get employers (for job seekers to browse)
router.get('/employers', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, employerType } = req.query;
    const skip = (page - 1) * limit;

    const query = { userType: 'employer', isActive: true };
    if (employerType) {
      query.employerType = employerType;
    }

    const users = await User.find(query)
      .select('-password -__v')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get employers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get employers',
      error: error.message
    });
  }
});

// Get employers by type
router.get('/employers/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    if (!['company', 'personal'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employer type'
      });
    }

    const employers = await User.find({
      userType: 'employer',
      employerType: type,
      isActive: true
    }).select('-password -__v');

    res.json({
      success: true,
      employers
    });
  } catch (error) {
    console.error('Get employers by type error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get employers',
      error: error.message
    });
  }
});

// Delete user account
router.delete('/:userId', authenticate, [
  body('password').notEmpty().withMessage('Password is required for account deletion')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { userId } = req.params;
    const { password } = req.body;
    const requestUserId = req.user.userId;

    // Check if user is deleting their own account
    if (userId !== requestUserId && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own account'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Account deletion cancelled.'
      });
    }

    // Soft delete: Mark as inactive instead of hard delete
    user.isActive = false;
    user.deletedAt = new Date();
    await user.save();

    // Invalidate cache
    const redisClient = getRedisClient();
    await redisClient.del(`user:${userId}`);

    // Publish user deleted event for cleanup in other services
    await publishEvent('user_events', 'user.deleted', {
      userId: user._id,
      userType: user.userType,
      email: user.email,
      deletedAt: user.deletedAt
    });

    res.json({
      success: true,
      message: 'Account deleted successfully. Your data will be removed from our systems.'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message
    });
  }
});

module.exports = router;

