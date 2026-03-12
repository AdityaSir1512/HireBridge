const express = require('express');
const { body } = require('express-validator');
const Event = require('../models/Event.model');

const router = express.Router();

// Track custom event
router.post('/track', [ body('event').isString().notEmpty(), body('payload').optional().isObject() ], async (req, res) => {
  try {
    const doc = await Event.create({ exchange: 'frontend', routingKey: req.body.event, payload: req.body.payload || {}, ts: new Date() });
    res.status(201).json({ success: true, event: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to track event' }); }
});

// Dashboard analytics (simple counts)
router.get('/dashboard/:userId', async (req, res) => {
  try {
    const [jobs, applications, messages] = await Promise.all([
      Event.countDocuments({ exchange: 'job_events' }),
      Event.countDocuments({ exchange: 'application_events' }),
      Event.countDocuments({ exchange: 'messaging_events' })
    ]);
    res.json({ success: true, dashboard: { jobs, applications, messages } });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get dashboard' }); }
});

// Job analytics
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const views = await Event.countDocuments({ exchange: 'frontend', routingKey: 'job.view', 'payload.jobId': req.params.jobId });
    const applications = await Event.countDocuments({ exchange: 'application_events', 'payload.jobId': req.params.jobId });
    res.json({ success: true, job: { views, applications } });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get job analytics' }); }
});

// User analytics
router.get('/users/:userId', async (req, res) => {
  try {
    const activity = await Event.find({ 'payload.userId': req.params.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, activity });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get user analytics' }); }
});

// Reports (placeholder)
router.get('/reports', async (req, res) => {
  try {
    const totalEvents = await Event.countDocuments();
    res.json({ success: true, report: { totalEvents } });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get reports' }); }
});

module.exports = router;
