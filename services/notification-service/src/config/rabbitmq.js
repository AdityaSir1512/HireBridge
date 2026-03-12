const amqp = require('amqplib');
const { createInAppNotification, sendEmailNotification, sendMultiChannelNotification } = require('../services/notifier');

let channel;

async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();

  // Declare exchanges we care about
  await channel.assertExchange('user_events', 'topic', { durable: true });
  await channel.assertExchange('job_events', 'topic', { durable: true });
  await channel.assertExchange('application_events', 'topic', { durable: true });
  await channel.assertExchange('payment_events', 'topic', { durable: true });
  await channel.assertExchange('messaging_events', 'topic', { durable: true });
  await channel.assertExchange('interview_events', 'topic', { durable: true });
  await channel.assertExchange('payment_events', 'topic', { durable: true });

  console.log('RabbitMQ exchanges declared');
  return channel;
}

async function startConsumers(ch) {
  // ============ Application Events ============
  
  // Application created → notify employer
  const appCreatedQ = await ch.assertQueue('notifications.application.created', { durable: true });
  await ch.bindQueue(appCreatedQ.queue, 'application_events', 'application.created');
  ch.consume(appCreatedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      await sendMultiChannelNotification(payload.employerId, {
        type: 'application_created',
        title: 'New Application Received',
        message: `You have received a new application for your job posting`,
        meta: payload,
        channels: ['in_app', 'email']
      });
      ch.ack(msg);
    } catch (e) {
      console.error('application.created handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Application status changed → notify applicant
  const appStatusQ = await ch.assertQueue('notifications.application.status', { durable: true });
  await ch.bindQueue(appStatusQ.queue, 'application_events', 'application.status.changed');
  ch.consume(appStatusQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.applicantId) {
        await sendMultiChannelNotification(payload.applicantId, {
          type: 'application_status',
          title: 'Application Status Updated',
          message: `Your application status is now: ${payload.status}`,
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('application.status.changed handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ Job Events ============
  
  // Job created → notify matched seekers
  const jobCreatedQ = await ch.assertQueue('notifications.job.created', { durable: true });
  await ch.bindQueue(jobCreatedQ.queue, 'job_events', 'job.created');
  ch.consume(jobCreatedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      // Job creation notification can be handled by matching service
      ch.ack(msg);
    } catch (e) {
      console.error('job.created handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Job updated
  const jobUpdatedQ = await ch.assertQueue('notifications.job.updated', { durable: true });
  await ch.bindQueue(jobUpdatedQ.queue, 'job_events', 'job.updated');
  ch.consume(jobUpdatedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      // Can notify applicants about job updates
      ch.ack(msg);
    } catch (e) {
      console.error('job.updated handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ Matching Events ============
  
  // Match found → notify job seeker
  const matchFoundQ = await ch.assertQueue('notifications.match.found', { durable: true });
  await ch.bindQueue(matchFoundQ.queue, 'matching_events', 'match.found');
  ch.consume(matchFoundQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await createInAppNotification(payload.userId, {
          type: 'match_found',
          title: 'New Job Match',
          message: 'We found a job that matches your profile!',
          meta: payload,
          priority: 'high'
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('match.found handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Recommendation generated
  const recommendationQ = await ch.assertQueue('notifications.recommendation', { durable: true });
  await ch.bindQueue(recommendationQ.queue, 'matching_events', 'recommendation.generated');
  ch.consume(recommendationQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await createInAppNotification(payload.userId, {
          type: 'recommendation',
          title: 'New Job Recommendations',
          message: 'Check out jobs we think you\'ll love',
          meta: payload
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('recommendation.generated handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ CV Events ============
  
  // CV processed
  const cvProcessedQ = await ch.assertQueue('notifications.cv.processed', { durable: true });
  await ch.bindQueue(cvProcessedQ.queue, 'cv_events', 'cv.processed');
  ch.consume(cvProcessedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await createInAppNotification(payload.userId, {
          type: 'cv_processed',
          title: 'CV Processed Successfully',
          message: 'Your CV has been analyzed and your profile has been updated',
          meta: payload
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('cv.processed handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // CV suggestions generated
  const cvSuggestionsQ = await ch.assertQueue('notifications.cv.suggestions', { durable: true });
  await ch.bindQueue(cvSuggestionsQ.queue, 'cv_events', 'cv.suggestions.generated');
  ch.consume(cvSuggestionsQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await createInAppNotification(payload.userId, {
          type: 'cv_suggestions',
          title: 'Job Suggestions Based on Your CV',
          message: `We found ${payload.count || 0} jobs that match your skills and experience`,
          meta: payload,
          priority: 'high'
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('cv.suggestions.generated handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ Messaging Events ============
  
  // Message received
  const messageReceivedQ = await ch.assertQueue('notifications.message.received', { durable: true });
  await ch.bindQueue(messageReceivedQ.queue, 'messaging_events', 'message.sent');
  ch.consume(messageReceivedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.recipientId) {
        await createInAppNotification(payload.recipientId, {
          type: 'message_received',
          title: 'New Message',
          message: `You have a new message from ${payload.senderName || 'a user'}`,
          meta: payload,
          priority: 'normal'
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('message.sent handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ Interview Events ============
  
  // Interview scheduled
  const interviewScheduledQ = await ch.assertQueue('notifications.interview.scheduled', { durable: true });
  await ch.bindQueue(interviewScheduledQ.queue, 'interview_events', 'interview.scheduled');
  ch.consume(interviewScheduledQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.candidateId) {
        await sendMultiChannelNotification(payload.candidateId, {
          type: 'interview_scheduled',
          title: 'Interview Scheduled',
          message: `Your interview has been scheduled for ${payload.startTime}`,
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('interview.scheduled handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Interview reminder
  const interviewReminderQ = await ch.assertQueue('notifications.interview.reminder', { durable: true });
  await ch.bindQueue(interviewReminderQ.queue, 'interview_events', 'interview.reminder');
  ch.consume(interviewReminderQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.candidateId) {
        await sendMultiChannelNotification(payload.candidateId, {
          type: 'interview_reminder',
          title: 'Interview Reminder',
          message: `Your interview is coming up soon: ${payload.startTime}`,
          meta: payload,
          channels: ['in_app', 'email', 'sms']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('interview.reminder handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Interview rescheduled
  const interviewRescheduledQ = await ch.assertQueue('notifications.interview.rescheduled', { durable: true });
  await ch.bindQueue(interviewRescheduledQ.queue, 'interview_events', 'interview.rescheduled');
  ch.consume(interviewRescheduledQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.candidateId) {
        await sendMultiChannelNotification(payload.candidateId, {
          type: 'interview_rescheduled',
          title: 'Interview Rescheduled',
          message: `Your interview has been rescheduled to ${payload.newStartTime}`,
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('interview.rescheduled handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Interview cancelled
  const interviewCancelledQ = await ch.assertQueue('notifications.interview.cancelled', { durable: true });
  await ch.bindQueue(interviewCancelledQ.queue, 'interview_events', 'interview.cancelled');
  ch.consume(interviewCancelledQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.candidateId) {
        await sendMultiChannelNotification(payload.candidateId, {
          type: 'interview_cancelled',
          title: 'Interview Cancelled',
          message: 'Your interview has been cancelled',
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('interview.cancelled handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // ============ Payment Events ============
  
  // Payment processed
  const paymentProcessedQ = await ch.assertQueue('notifications.payment.processed', { durable: true });
  await ch.bindQueue(paymentProcessedQ.queue, 'payment_events', 'payment.processed');
  ch.consume(paymentProcessedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await sendMultiChannelNotification(payload.userId, {
          type: 'payment_processed',
          title: 'Payment Successful',
          message: `Your payment of ${payload.amount} has been processed`,
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('payment.processed handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Subscription created
  const subscriptionCreatedQ = await ch.assertQueue('notifications.subscription.created', { durable: true });
  await ch.bindQueue(subscriptionCreatedQ.queue, 'payment_events', 'subscription.created');
  ch.consume(subscriptionCreatedQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await sendMultiChannelNotification(payload.userId, {
          type: 'subscription_created',
          title: 'Subscription Activated',
          message: `Your ${payload.plan} subscription is now active`,
          meta: payload,
          channels: ['in_app', 'email']
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('subscription.created handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  // Subscription cancelled
  const subscriptionCancelledQ = await ch.assertQueue('notifications.subscription.cancelled', { durable: true });
  await ch.bindQueue(subscriptionCancelledQ.queue, 'payment_events', 'subscription.cancelled');
  ch.consume(subscriptionCancelledQ.queue, async (msg) => {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString());
      if (payload.userId) {
        await createInAppNotification(payload.userId, {
          type: 'subscription_cancelled',
          title: 'Subscription Cancelled',
          message: 'Your subscription has been cancelled',
          meta: payload
        });
      }
      ch.ack(msg);
    } catch (e) {
      console.error('subscription.cancelled handling error:', e);
      ch.nack(msg, false, true);
    }
  });

  console.log('✅ All notification consumers started');
}

module.exports = { connectRabbitMQ, startConsumers };
