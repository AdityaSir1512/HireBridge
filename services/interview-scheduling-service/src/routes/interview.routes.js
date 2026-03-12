const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Interview = require('../models/Interview.model');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

// Schedule interview
router.post('/schedule', [
  body('jobId').isString().notEmpty(),
  body('employerId').isString().notEmpty(),
  body('candidateId').isString().notEmpty(),
  body('type').optional().isIn(['phone','video','in_person']),
  body('startTime').isISO8601(),
  body('endTime').isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const doc = await Interview.create(req.body);
    await publishEvent('interview.scheduled', { interviewId: doc._id, jobId: doc.jobId, employerId: doc.employerId, candidateId: doc.candidateId });
    res.status(201).json({ success: true, interview: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to schedule interview' }); }
});

// Reschedule
router.put('/:interviewId/reschedule', [ body('startTime').isISO8601(), body('endTime').isISO8601() ], async (req, res) => {
  try {
    const doc = await Interview.findByIdAndUpdate(req.params.interviewId, { startTime: req.body.startTime, endTime: req.body.endTime, status: 'rescheduled' }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Interview not found' });
    await publishEvent('interview.rescheduled', { interviewId: doc._id });
    res.json({ success: true, interview: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to reschedule' }); }
});

// Cancel
router.delete('/:interviewId', async (req, res) => {
  try {
    const doc = await Interview.findByIdAndUpdate(req.params.interviewId, { status: 'cancelled' }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Interview not found' });
    await publishEvent('interview.cancelled', { interviewId: doc._id });
    res.json({ success: true, interview: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to cancel' }); }
});

// Get user's interviews
router.get('/user/:userId', async (req, res) => {
  try {
    const list = await Interview.find({ $or: [{ employerId: req.params.userId }, { candidateId: req.params.userId }] }).sort({ startTime: 1 });
    res.json({ success: true, interviews: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to fetch interviews' }); }
});

// Calendar events
router.get('/calendar/:userId', async (req, res) => {
  try {
    const list = await Interview.find({ $or: [{ employerId: req.params.userId }, { candidateId: req.params.userId }], status: { $ne: 'cancelled' } }).sort({ startTime: 1 });
    const events = list.map(i => ({ id: String(i._id), title: 'Interview', start: i.startTime, end: i.endTime }));
    res.json({ success: true, events });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to fetch calendar' }); }
});

module.exports = router;
