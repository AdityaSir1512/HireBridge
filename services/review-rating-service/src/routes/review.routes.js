const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Review = require('../models/Review.model');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

// Create review
router.post('/', [
  body('reviewerId').isString().notEmpty(),
  body('targetUserId').isString().notEmpty(),
  body('rating').isInt({ min: 1, max: 5 }),
  body('text').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const doc = await Review.create(req.body);
    await publishEvent('review.created', { reviewId: doc._id, targetUserId: doc.targetUserId, rating: doc.rating });
    res.status(201).json({ success: true, review: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to create review' }); }
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const list = await Review.find({ targetUserId: req.params.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, reviews: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get reviews' }); }
});

// Get review
router.get('/:reviewId', async (req, res) => {
  try {
    const doc = await Review.findById(req.params.reviewId);
    if (!doc) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, review: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get review' }); }
});

// Update review
router.put('/:reviewId', async (req, res) => {
  try {
    const doc = await Review.findByIdAndUpdate(req.params.reviewId, req.body, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, review: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to update review' }); }
});

// Delete review
router.delete('/:reviewId', async (req, res) => {
  try {
    const doc = await Review.findByIdAndDelete(req.params.reviewId);
    if (!doc) return res.status(404).json({ success: false, message: 'Review not found' });
    res.json({ success: true, message: 'Review deleted' });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to delete review' }); }
});

// Report review
router.post('/:reviewId/report', async (req, res) => {
  try {
    const doc = await Review.findByIdAndUpdate(req.params.reviewId, { reported: true }, { new: true });
    if (!doc) return res.status(404).json({ success: false, message: 'Review not found' });
    await publishEvent('review.reported', { reviewId: doc._id });
    res.json({ success: true, review: doc });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to report review' }); }
});

// Stats for a user
router.get('/stats/:userId', async (req, res) => {
  try {
    const agg = await Review.aggregate([
      { $match: { targetUserId: new (require('mongoose')).Types.ObjectId(req.params.userId) } },
      { $group: { _id: '$targetUserId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    const stats = agg[0] || { avgRating: 0, count: 0 };
    res.json({ success: true, stats });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get stats' }); }
});

module.exports = router;
