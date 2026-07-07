import { Redis } from 'ioredis';
import { config } from './config';

const redis = new Redis(config.getKey('REDIS_URL'), {
  enableOfflineQueue: false,
  lazyConnect: false,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err: Error) => {
  console.error('[redis] connection error:', err.message);
});

export { redis };
