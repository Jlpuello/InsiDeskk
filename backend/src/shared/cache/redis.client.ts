import type { RedisClientType } from 'redis';
import { closeRedisClient, getRedisClient } from '../../config/redis.js';
import { logger } from '../utils/logger.js';

// Facade de conveniencia usada por el módulo de cache. La conexión real y su
// configuración por entorno viven en config/redis.ts para no duplicarlas aquí.
export class RedisClient {
  static async getInstance(): Promise<RedisClientType> {
    return getRedisClient();
  }

  static async disconnect(): Promise<void> {
    await closeRedisClient();
    logger.info('Redis disconnected');
  }
}
