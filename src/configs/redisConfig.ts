import Redis, { RedisOptions } from 'ioredis';
import { config } from './envConfig';

let reconnectAttempts = 0;
const redisUrl = config.REDIS_URL || 'redis://127.0.0.1:6379';
const isTls = typeof redisUrl === 'string' && redisUrl.startsWith('rediss://');

const redisOptions: RedisOptions = {
  keyPrefix: config.REDIS_PREFIX,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  ...(isTls
    ? {
        tls: {
          rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true',
        },
      }
    : {}),
  retryStrategy(times) {
    reconnectAttempts = times;
    if (times > 20) {
      console.error(`[Redis] Connection failed after ${times} attempts. Backing off...`);
      return Math.min(times * 1000, 15000);
    }
    const delay = Math.min(times * 300, 5000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = 'READONLY';
    if (err.message && err.message.includes(targetError)) {
      return true;
    }
    return false;
  },
};

const redis = new Redis(redisUrl, redisOptions);

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

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redis && redis.status !== 'end') {
      await redis.quit().catch(() => redis.disconnect());
    }
  } catch (err: any) {
    console.warn('[Redis] Disconnect notice:', err?.message || err);
  }
};

export default redis;