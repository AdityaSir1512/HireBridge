const express = require('express');
const { body, validationResult } = require('express-validator');
const Subscription = require('../models/Subscription.model');
const Invoice = require('../models/Invoice.model');
const { publishEvent } = require('../config/rabbitmq');

const router = express.Router();

// Create subscription
router.post('/create-subscription', [
  body('userId').isString().notEmpty(),
  body('plan').isIn(['basic','pro','enterprise'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const sub = await Subscription.create({ userId: req.body.userId, plan: req.body.plan });
    await publishEvent('subscription.created', { userId: sub.userId, plan: sub.plan, subscriptionId: sub._id });
    res.status(201).json({ success: true, subscription: sub });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to create subscription' }); }
});

// Get user subscription
router.get('/subscription/:userId', async (req, res) => {
  try {
    const sub = await Subscription.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, subscription: sub });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get subscription' }); }
});

// Cancel subscription
router.post('/cancel-subscription', [ body('userId').isString().notEmpty() ], async (req, res) => {
  try {
    const sub = await Subscription.findOneAndUpdate({ userId: req.body.userId }, { status: 'canceled', endsAt: new Date() }, { new: true });
    await publishEvent('subscription.cancelled', { userId: req.body.userId });
    res.json({ success: true, subscription: sub });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to cancel subscription' }); }
});

// Create invoice (simple)
router.post('/invoice', [ body('userId').isString().notEmpty(), body('amount').isFloat({ min: 0.01 }) ], async (req, res) => {
  try {
    const inv = await Invoice.create({ userId: req.body.userId, amount: req.body.amount, currency: req.body.currency || 'USD', description: req.body.description || '' });
    await publishEvent('payment.processed', { userId: inv.userId, amount: inv.amount, invoiceId: inv._id });
    res.status(201).json({ success: true, invoice: inv });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to create invoice' }); }
});

// Get invoices for user
router.get('/invoices/:userId', async (req, res) => {
  try {
    const list = await Invoice.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json({ success: true, invoices: list });
  } catch (e) { res.status(500).json({ success: false, message: 'Failed to get invoices' }); }
});

// Webhook (Stripe stub)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify signature with STRIPE_WEBHOOK_SECRET in real implementation
    res.json({ received: true });
  } catch (e) { res.status(400).json({ success: false }); }
});

module.exports = router;
