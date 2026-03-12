const redis = require('redis');
let client;

module.exports = async function connectRedis() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  client = redis.createClient({ url });
  client.on('error', (e) => console.error('Redis error (Job Service):', e));
  await client.connect();
  console.log('Redis connected (Job Service)');
  return client;
};

module.exports.getClient = function getClient() {
  if (!client) throw new Error('Redis client not initialized');
  return client;
};
