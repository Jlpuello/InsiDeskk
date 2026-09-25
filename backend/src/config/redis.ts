import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import { logger } from '../shared/utils/logger.js';

let client: RedisClientType | null = null;

function createRedisConnection(): RedisClientType {
  const instance: RedisClientType = createClient({
    socket: {
      host: env.redisHost,
      port: env.redisPort,
      reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
    },
    password: env.redisPassword || undefined,
    database: env.redisDb,
  });

  instance.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  instance.on('connect', () => logger.info('Redis connected'));
  instance.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  return instance;
}

// Singleton: toda la app comparte una única conexión Redis.
export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createRedisConnection();
  }
  if (!client.isOpen) {
    await client.connect();
  }
  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client?.isOpen) {
    await client.quit();
  }
  client = null;
}
