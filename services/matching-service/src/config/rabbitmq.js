const amqp = require('amqplib');
let channel;

module.exports.connectRabbitMQ = async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();
  await channel.assertExchange('matching_events', 'topic', { durable: true });
  console.log('RabbitMQ connected (Matching Service)');
  return channel;
};

module.exports.publishEvent = function publishEvent(routingKey, payload) {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.publish('matching_events', routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
};
