const amqp = require('amqplib');
const Event = require('../models/Event.model');

let channel;

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://rabbitmq:5672';
  const maxAttempts = 10;
  const baseDelayMs = 1000;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await amqp.connect(url);
      channel = await conn.createChannel();
      break;
    } catch (e) {
      lastError = e;
      const delay = baseDelayMs * attempt;
      console.warn(`RabbitMQ connect attempt ${attempt}/${maxAttempts} failed; retrying in ${delay}ms`);
      await wait(delay);
    }
  }
  if (!channel) {
    throw lastError || new Error('Failed to connect to RabbitMQ');
  }

  // Declare exchanges to bind
  const exchanges = [
    'user_events',
    'job_events',
    'application_events',
    'matching_events',
    'chatbot_events',
    'messaging_events',
    'interview_events',
    'payment_events',
    'review_events'
  ];
  for (const ex of exchanges) {
    await channel.assertExchange(ex, 'topic', { durable: true });
  }
  return channel;
}

async function startConsumers(ch) {
  const bindings = [
    { ex: 'user_events', key: '#' },
    { ex: 'job_events', key: '#' },
    { ex: 'application_events', key: '#' },
    { ex: 'matching_events', key: '#' },
    { ex: 'chatbot_events', key: '#' },
    { ex: 'messaging_events', key: '#' },
    { ex: 'interview_events', key: '#' },
    { ex: 'payment_events', key: '#' },
    { ex: 'review_events', key: '#' }
  ];

  for (const { ex, key } of bindings) {
    const q = await ch.assertQueue(`analytics.${ex}.${key.replace('#','all')}`, { durable: true });
    await ch.bindQueue(q.queue, ex, key);
    ch.consume(q.queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await Event.create({ exchange: ex, routingKey: msg.fields.routingKey, payload, ts: new Date() });
        ch.ack(msg);
      } catch (e) {
        console.error('Analytics consumer error:', e);
        ch.nack(msg, false, true);
      }
    });
  }
}

module.exports = { connectRabbitMQ, startConsumers };
