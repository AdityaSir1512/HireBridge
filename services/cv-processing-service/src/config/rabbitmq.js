const amqp = require('amqplib');
let channel;

module.exports.connectRabbitMQ = async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
  const conn = await amqp.connect(url);
  channel = await conn.createChannel();
  await channel.assertExchange('cv_events', 'topic', { durable: true });
  console.log('RabbitMQ connected (CV Service)');
  return channel;
};

module.exports.publishEvent = function publishEvent(routingKey, payload) {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  channel.publish('cv_events', routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true });
};
