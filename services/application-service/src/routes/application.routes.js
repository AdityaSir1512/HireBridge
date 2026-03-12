const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Application = require('../models/Application.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { getClient } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

// Submit application (job seeker only)
router.post('/', authenticate, authorize('job_seeker'), [
  body('jobId').isString().notEmpty(),
  body('employerId').isString().notEmpty(),
  body('coverLetter').optional().isString(),
  body('resumeUrl').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const appDoc = await Application.create({
      jobId: req.body.jobId,
      employerId: req.body.employerId,
      applicantId: req.user.userId,
      coverLetter: req.body.coverLetter || '',
      resumeUrl: req.body.resumeUrl || ''
    });

    await publishEvent('application.created', { applicationId: appDoc._id, jobId: appDoc.jobId, employerId: appDoc.employerId, applicantId: appDoc.applicantId });

    res.status(201).json({ success: true, application: appDoc });
  } catch (e) {
    console.error('Create application error:', e);
    res.status(500).json({ success: false, message: 'Failed to submit application' });
  }
});

// Get application by id (owner or employer)
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const appDoc = await Application.findById(req.params.applicationId);
    if (!appDoc) return res.status(404).json({ success: false, message: 'Application not found' });

    const isApplicant = String(appDoc.applicantId) === req.user.userId;
    const isEmployer = String(appDoc.employerId) === req.user.userId;
    if (!isApplicant && !isEmployer) return res.status(403).json({ success: false, message: 'Forbidden' });

    res.json({ success: true, application: appDoc });
  } catch (e) {
    console.error('Get application error:', e);
    res.status(500).json({ success: false, message: 'Failed to get application' });
  }
});

// Get applications for a job (employer only)
router.get('/job/:jobId', authenticate, authorize('employer'), async (req, res) => {
  try {
    const docs = await Application.find({ jobId: req.params.jobId, employerId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, applications: docs });
  } catch (e) {
    console.error('Get job applications error:', e);
    res.status(500).json({ success: false, message: 'Failed to get applications' });
  }
});

// Get ALL applications for employer's jobs (employer only)
router.get('/employer/all', authenticate, authorize('employer'), async (req, res) => {
  try {
    const docs = await Application.find({ employerId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, applications: docs, count: docs.length });
  } catch (e) {
    console.error('Get employer applications error:', e);
    res.status(500).json({ success: false, message: 'Failed to get applications' });
  }
});

// Get applications for a user (job seeker only)
router.get('/user/:userId', authenticate, async (req, res) => {
  try {
    if (req.params.userId !== req.user.userId) return res.status(403).json({ success: false, message: 'Forbidden' });
    const docs = await Application.find({ applicantId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, applications: docs });
  } catch (e) {
    console.error('Get user applications error:', e);
    res.status(500).json({ success: false, message: 'Failed to get applications' });
  }
});

// Update application status (employer only)
router.put('/:applicationId/status', authenticate, authorize('employer'), [
  body('status').isIn(['submitted','review','shortlisted','interview','rejected','hired'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const appDoc = await Application.findById(req.params.applicationId);
    if (!appDoc) return res.status(404).json({ success: false, message: 'Application not found' });
    if (String(appDoc.employerId) !== req.user.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    appDoc.status = req.body.status;
    await appDoc.save();

    await publishEvent('application.status.changed', { applicationId: appDoc._id, status: appDoc.status });

    res.json({ success: true, application: appDoc });
  } catch (e) {
    console.error('Update status error:', e);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

module.exports = router;
