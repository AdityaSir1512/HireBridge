const amqp = require('amqplib');
let channel;

module.exports = async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();
  await channel.assertExchange('application_events', 'topic', { durable: true });
  console.log('RabbitMQ connected (Application Service)');
  return channel;
};

module.exports.publishEvent = function publishEvent(routingKey, payload) {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.publish('application_events', routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
};
