const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Job = require('../models/Job.model');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { getClient } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

// Create job (employer only)
router.post('/', authenticate, authorize('employer'), [
  body('title').trim().notEmpty(),
  body('description').trim().notEmpty(),
  body('jobType').isIn(['freelancing', 'full_time', 'internship']),
  body('employerType').isIn(['company', 'personal'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const job = await Job.create({
      title: req.body.title,
      description: req.body.description,
      jobType: req.body.jobType,
      skills: req.body.skills || [],
      location: req.body.location || '',
      salaryMin: req.body.salaryMin || 0,
      salaryMax: req.body.salaryMax || 0,
      company: req.body.company || {},
      employerId: req.user.userId,
      employerType: req.body.employerType,
      status: req.body.status || 'active',
      visibility: req.body.visibility || 'public'
    });

    await publishEvent('job.created', { jobId: job._id, jobType: job.jobType });

    res.status(201).json({ success: true, job });
  } catch (e) {
    console.error('Create job error:', e);
    res.status(500).json({ success: false, message: 'Failed to create job' });
  }
});

// Get job by id
router.get('/:jobId', authenticate, async (req, res) => {
  try {
    const redis = getClient();
    const cacheKey = `job:${req.params.jobId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, job: JSON.parse(cached) });

    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    await redis.setEx(cacheKey, 3600, JSON.stringify(job));
    res.json({ success: true, job });
  } catch (e) {
    console.error('Get job error:', e);
    res.status(500).json({ success: false, message: 'Failed to get job' });
  }
});

// Update job (employer only)
router.put('/:jobId', authenticate, authorize('employer'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.employerId) !== req.user.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const updatable = ['title','description','jobType','skills','location','salaryMin','salaryMax','company','status','visibility'];
    updatable.forEach(f => { if (req.body[f] !== undefined) job[f] = req.body[f]; });

    await job.save();
    const redis = getClient();
    await redis.del(`job:${job._id}`);

    await publishEvent('job.updated', { jobId: job._id });
    res.json({ success: true, job });
  } catch (e) {
    console.error('Update job error:', e);
    res.status(500).json({ success: false, message: 'Failed to update job' });
  }
});

// Delete job (employer only)
router.delete('/:jobId', authenticate, authorize('employer'), async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (String(job.employerId) !== req.user.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    await job.deleteOne();
    const redis = getClient();
    await redis.del(`job:${job._id}`);

    await publishEvent('job.deleted', { jobId: req.params.jobId });
    res.json({ success: true, message: 'Job deleted' });
  } catch (e) {
    console.error('Delete job error:', e);
    res.status(500).json({ success: false, message: 'Failed to delete job' });
  }
});

// Employer's own jobs
router.get('/employer/:employerId/list', authenticate, authorize('employer'), async (req, res) => {
  try {
    if (req.params.employerId !== req.user.userId) return res.status(403).json({ success: false, message: 'Forbidden' });
    const jobs = await Job.find({ employerId: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (e) {
    console.error('Employer jobs error:', e);
    res.status(500).json({ success: false, message: 'Failed to fetch employer jobs' });
  }
});

// Search & filter jobs
router.get('/', authenticate, [
  query('q').optional().isString(),
  query('jobType').optional().isIn(['freelancing','full_time','internship']),
  query('employerType').optional().isIn(['company','personal']),
  query('location').optional().isString(),
  query('skills').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { q, jobType, employerType, location, skills, page = 1, limit = 20 } = req.query;

    const filters = { status: 'active', visibility: 'public' };
    if (jobType) filters.jobType = jobType;
    if (employerType) filters.employerType = employerType;
    if (location) filters.location = new RegExp(location, 'i');
    if (skills) filters.skills = { $in: skills.split(',').map(s => s.trim()) };

    const textFilter = q ? { $text: { $search: q } } : {};

    const jobs = await Job.find({ ...filters, ...textFilter })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Job.countDocuments({ ...filters, ...textFilter });

    res.json({ success: true, jobs, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total/limit) } });
  } catch (e) {
    console.error('Search jobs error:', e);
    res.status(500).json({ success: false, message: 'Failed to search jobs' });
  }
});

// Jobs by type
router.get('/by-type/:type', authenticate, async (req, res) => {
  try {
    const type = req.params.type;
    if (!['freelancing','full_time','internship'].includes(type)) return res.status(400).json({ success: false, message: 'Invalid job type' });
    const jobs = await Job.find({ jobType: type, status: 'active', visibility: 'public' }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to fetch jobs' }); }
});

// Jobs by employer type
router.get('/by-employer-type/:etype', authenticate, async (req, res) => {
  try {
    const etype = req.params.etype;
    if (!['company','personal'].includes(etype)) return res.status(400).json({ success: false, message: 'Invalid employer type' });
    const jobs = await Job.find({ employerType: etype, status: 'active', visibility: 'public' }).sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to fetch jobs' }); }
});

module.exports = router;
