const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const client = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
});

client.on('connect', () => {
    console.log('Redis connected successfully!');
});

client.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

client.connect();

module.exports = client;