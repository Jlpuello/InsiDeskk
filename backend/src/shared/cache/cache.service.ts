import { RedisClient } from './redis.client.js';
import { logger } from '../utils/logger.js';

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await RedisClient.getInstance();
      const value = await client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (err) {
      logger.error(`Cache get error [${key}]: ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const client = await RedisClient.getInstance();
      const json = JSON.stringify(value);
      if (ttl) {
        await client.setEx(key, ttl, json);
      } else {
        await client.set(key, json);
      }
      logger.debug(`Cache set [${key}]${ttl ? ` ttl=${ttl}s` : ''}`);
    } catch (err) {
      logger.error(`Cache set error [${key}]: ${(err as Error).message}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const client = await RedisClient.getInstance();
      await client.del(key);
    } catch (err) {
      logger.error(`Cache delete error [${key}]: ${(err as Error).message}`);
    }
  }

  async invalidatePattern(pattern: string | string[]): Promise<void> {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    try {
      const client = await RedisClient.getInstance();
      const keys = (await Promise.all(patterns.map((p) => client.keys(p)))).flat();
      if (keys.length > 0) {
        await client.del(keys);
        logger.debug(`Cache invalidado: ${keys.length} key(s) con patrón(es) "${patterns.join(', ')}"`);
      }
    } catch (err) {
      logger.error(`Cache invalidate pattern error [${patterns.join(', ')}]: ${(err as Error).message}`);
    }
  }
}

// Instancia compartida: no hay contenedor de DI en este backend, así que las
// features importan este singleton directamente (mismo patrón que otras
// utilidades de shared/, p.ej. logger).
export const cacheService = new CacheService();
