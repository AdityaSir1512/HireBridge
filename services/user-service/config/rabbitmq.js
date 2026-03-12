const amqp = require('amqplib');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const url = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    // Declare exchanges
    await channel.assertExchange('user_events', 'topic', { durable: true });

    // Declare queues
    await channel.assertQueue('user.created', { durable: true });
    await channel.assertQueue('user.updated', { durable: true });
    await channel.assertQueue('user.deleted', { durable: true });
    await channel.assertQueue('user.preference.changed', { durable: true });

    // Bind queues to exchange
    await channel.bindQueue('user.created', 'user_events', 'user.created');
    await channel.bindQueue('user.updated', 'user_events', 'user.updated');
    await channel.bindQueue('user.deleted', 'user_events', 'user.deleted');
    await channel.bindQueue('user.preference.changed', 'user_events', 'user.preference.changed');

    console.log('RabbitMQ connected and queues declared');
    return { connection, channel };
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
    throw error;
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

const publishEvent = async (exchange, routingKey, message) => {
  try {
    const ch = getChannel();
    await ch.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    console.log(`Event published: ${routingKey}`);
  } catch (error) {
    console.error('Error publishing event:', error);
    throw error;
  }
};

module.exports = connectRabbitMQ;
module.exports.getChannel = getChannel;
module.exports.publishEvent = publishEvent;

