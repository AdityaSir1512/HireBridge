const express = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { getClient } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { recommendJobsForUser, findCandidatesForJob } = require('../services/matching.engine');

const router = express.Router();

router.post('/recalculate/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const redis = getClient();
    const keys = await redis.keys(`matches:${userId}:type:*`);
    if (keys.length) await redis.del(keys);
    res.json({ success: true, message: 'Recalculation requested' });
  } catch (e) {
    console.error('Recalculate error:', e);
    res.status(500).json({ success: false, message: 'Failed to recalculate' });
  }
});

router.get('/recommendations/:userId', authenticate, async (req, res) => {
  try {
    const user = { userId: req.params.userId, profile: { skills: req.query.skills ? req.query.skills.split(',') : [] }, jobTypePreference: req.query.jobTypePreference };
    const recs = await recommendJobsForUser(user);
    await publishEvent('recommendation.generated', { userId: user.userId, count: recs.length });
    res.json({ success: true, recommendations: recs });
  } catch (e) {
    console.error('Recommendations error:', e);
    res.status(500).json({ success: false, message: 'Failed to get recommendations' });
  }
});

router.get('/matches/:jobId', authenticate, async (req, res) => {
  try {
    const job = { _id: req.params.jobId, skills: req.query.skills ? req.query.skills.split(',') : [] };
    const candidates = await findCandidatesForJob(job, []);
    await publishEvent('match.found', { jobId: job._id, count: candidates.length });
    res.json({ success: true, matches: candidates });
  } catch (e) {
    console.error('Job matches error:', e);
    res.status(500).json({ success: false, message: 'Failed to get matches' });
  }
});

module.exports = router;
