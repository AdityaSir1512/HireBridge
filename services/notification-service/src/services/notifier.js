const Notification = require('../models/Notification.model');
const NotificationPreference = require('../models/NotificationPreference.model');
const nodemailer = require('nodemailer');
const { getClient } = require('../config/redis');
const { notifyUser } = require('./websocket');
const { getEmailTemplate } = require('./templates');

// Simple email transport (stub: logs to console if no SMTP)
const transporter = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
}) : null;

/**
 * Get user notification preferences
 */
async function getUserPreferences(userId) {
  try {
    // Try cache first
    const redis = getClient();
    const cacheKey = `notification_prefs:${userId}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    let preferences = await NotificationPreference.findOne({ userId });
    
    // Create default if not exists
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId });
    }

    // Cache for 1 hour
    await redis.setEx(cacheKey, 3600, JSON.stringify(preferences));
    
    return preferences;
  } catch (error) {
    console.error('Failed to get user preferences:', error);
    return null;
  }
}

/**
 * Check if user is in quiet hours
 */
function isQuietHours(preferences) {
  if (!preferences || !preferences.quietHoursEnabled) {
    return false;
  }

  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const start = preferences.quietHoursStart || '22:00';
  const end = preferences.quietHoursEnd || '08:00';

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  
  return currentTime >= start && currentTime < end;
}

/**
 * Create in-app notification
 */
async function createInAppNotification(userId, { type, title, message, meta, priority, actionUrl, actionText, expiresAt }) {
  const notif = await Notification.create({ 
    userId, 
    type, 
    title, 
    message, 
    meta: meta || {},
    priority: priority || 'normal',
    actionUrl: actionUrl || '',
    actionText: actionText || '',
    expiresAt: expiresAt || null
  });

  // Invalidate cache
  const redis = getClient();
  await redis.del(`notifications:${userId}`);
  await redis.del(`unread_count:${userId}`);

  // Send real-time notification
  notifyUser(userId.toString(), notif);

  return notif;
}

/**
 * Get user email from User Service
 */
async function getUserEmail(userId) {
  try {
    // In production, call User Service API
    const userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
    const response = await fetch(`${userServiceUrl}/api/users/profile/${userId}`);
    if (response.ok) {
      const data = await response.json();
      return data.user?.email || null;
    }
  } catch (error) {
    console.error('Failed to get user email:', error);
  }
  return null;
}

/**
 * Send email notification with template
 */
async function sendEmailNotification(userId, subject, text, html = null, notificationType = 'system', templateData = {}) {
  try {
    // Get user email
    const userEmail = await getUserEmail(userId);
    
    // Use template if notification type is provided
    let emailContent = { subject, html: html || `<p>${text}</p>` };
    if (notificationType && templateData) {
      emailContent = getEmailTemplate(notificationType, templateData);
    }

    if (!transporter) {
      console.log(`[Email Stub] To user ${userId} (${userEmail || 'unknown'}): ${emailContent.subject}`);
      return true;
    }

    if (!userEmail) {
      console.warn(`No email found for user ${userId}`);
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'HireBridge <noreply@hirebridge.com>',
      to: userEmail,
      subject: emailContent.subject,
      text: text,
      html: emailContent.html
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${userEmail}: ${emailContent.subject}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

/**
 * Send SMS notification (stub)
 */
async function sendSMSNotification(userId, message) {
  // TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)
  console.log(`[SMS Stub] To user ${userId}: ${message}`);
  return true;
}

/**
 * Send push notification (stub)
 */
async function sendPushNotification(userId, { title, message, data }) {
  // TODO: Integrate with push service (Firebase, OneSignal, etc.)
  console.log(`[Push Stub] To user ${userId}: ${title} - ${message}`);
  return true;
}

/**
 * Send notification through multiple channels with preference checking
 */
async function sendMultiChannelNotification(userId, { type, title, message, meta, channels = ['in_app'], priority = 'normal' }) {
  const results = {};

  try {
    // Get user preferences
    const preferences = await getUserPreferences(userId);

    // Check if globally muted
    if (preferences && preferences.globalMute) {
      console.log(`Notifications muted for user ${userId}`);
      return { muted: true };
    }

    // Check quiet hours (except for urgent priority)
    if (priority !== 'urgent' && preferences && isQuietHours(preferences)) {
      console.log(`User ${userId} is in quiet hours`);
      // Still create in-app notification, but skip others
      channels = ['in_app'];
    }

    // Get notification type preferences
    const typePrefs = preferences?.preferences?.[type] || null;

    // In-app notification (always create unless specifically disabled)
    if (channels.includes('in_app') && (!typePrefs || typePrefs.inApp !== false)) {
      try {
        results.inApp = await createInAppNotification(userId, { type, title, message, meta, priority });
      } catch (error) {
        console.error('In-app notification error:', error);
        results.inApp = { error: error.message };
      }
    }

    // Email notification (check preferences)
    if (channels.includes('email') && typePrefs && typePrefs.email) {
      try {
        results.email = await sendEmailNotification(
          userId, 
          title, 
          message, 
          null, 
          type, 
          { ...meta, title, message }
        );
      } catch (error) {
        console.error('Email notification error:', error);
        results.email = { error: error.message };
      }
    }

    // SMS notification (check preferences)
    if (channels.includes('sms') && typePrefs && typePrefs.sms) {
      try {
        results.sms = await sendSMSNotification(userId, message);
      } catch (error) {
        console.error('SMS notification error:', error);
        results.sms = { error: error.message };
      }
    }

    // Push notification (check preferences)
    if (channels.includes('push') && typePrefs && typePrefs.push) {
      try {
        results.push = await sendPushNotification(userId, { title, message, data: meta });
      } catch (error) {
        console.error('Push notification error:', error);
        results.push = { error: error.message };
      }
    }

    return results;
  } catch (error) {
    console.error('Multi-channel notification error:', error);
    return { error: error.message };
  }
}

module.exports = { 
  createInAppNotification, 
  sendEmailNotification,
  sendSMSNotification,
  sendPushNotification,
  sendMultiChannelNotification,
  getUserEmail,
  getUserPreferences
};
