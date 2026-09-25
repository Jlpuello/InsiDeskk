import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { setupPrismaMiddleware } from './middleware/index.js';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      errorFormat: 'pretty',
      log: process.env.NODE_ENV === 'development' ? ['info', 'warn', 'error'] : ['error'],
    });

    setupPrismaMiddleware(prisma);

    logger.info('Prisma Client initialized');
  }

  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma Client disconnected');
  }
}

// Export type for use in services
export type PrismaClientType = PrismaClient;
