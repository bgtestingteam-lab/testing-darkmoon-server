import Redis from 'ioredis';
import { config } from './envConfig';

let reconnectAttempts = 0;

const redis = new Redis(config.REDIS_URL, {
  keyPrefix: config.REDIS_PREFIX,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    reconnectAttempts = times;
    if (times > 10) {
      console.error(`[Redis] Connection failed after ${times} attempts. Please check REDIS_URL.`);
    }
    const delay = Math.min(times * 300, 5000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
});

redis.on('connect', () => {
  reconnectAttempts = 0;
  console.log(`[Redis] Connected successfully (prefix: ${config.REDIS_PREFIX || 'none'})`);
});

redis.on('ready', () => {
  console.log('[Redis] Ready to process commands');
});

redis.on('error', (err: any) => {
  console.error(`[Redis] Connection error: ${err?.message || err}`);
});

redis.on('close', () => {
  console.warn('[Redis] Connection closed');
});

redis.on('reconnecting', (delay: number) => {
  console.info(`[Redis] Reconnecting in ${delay}ms...`);
});

export default redis;