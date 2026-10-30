import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { getPrismaClient, disconnectPrisma } from './shared/prisma/client.js';
import { vaultService } from './config/vault.js';
import { logger } from './shared/utils/logger.js';
import { getRedisClient, closeRedisClient } from './config/redis.js';
import { eventEmitter } from './shared/events/event.emitter.js';
import { DeviceStatusUpdaterService } from './shared/services/device-status-updater.service.js';
import { registerNotificationListeners, shutdownNotificationQueues } from './features/notifications/index.js';
import { monitoringService } from './shared/monitoring/monitoring.service.js';
import { backupService } from './shared/backup/backup.service.js';
import { activityRecurrenceScheduler } from './features/activities/index.js';
import { quoteExpirationScheduler } from './features/quotes/index.js';
import { remotelyPackageIntegrityScheduler } from './features/remotely/index.js';
import { glpiStaleDevicesScheduler } from './features/glpi-agent/index.js';
import { registerConversationRealtime } from './features/conversations/index.js';
import { registerTeamChatRealtime } from './features/team-chat/index.js';
import { initSocketServer } from './shared/realtime/socket.server.js';

const deviceStatusUpdater = new DeviceStatusUpdaterService();

async function startServer(): Promise<void> {
  try {
    logger.info('Loading secrets...');
    await vaultService.loadSecrets();

    logger.info('Initializing Prisma...');
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Prisma connected');

    logger.info('Connecting Redis...');
    await getRedisClient();

    logger.info('Starting monitoring...');
    monitoringService.monitorSecurityMetrics();

    logger.info('Starting backup service...');
    backupService.start();

    registerNotificationListeners();
    deviceStatusUpdater.start(5);
    activityRecurrenceScheduler.start();
    quoteExpirationScheduler.start();
    remotelyPackageIntegrityScheduler.start();
    glpiStaleDevicesScheduler.start();

    const app = createApp();
    // http.Server explícito (en vez de que app.listen() lo cree solo) para
    // que Socket.IO pueda adjuntarse al mismo puerto — ver
    // shared/realtime/socket.server.ts, primera vez que la app necesita esto.
    const server = createServer(app);
    initSocketServer(server);
    registerConversationRealtime();
    registerTeamChatRealtime();

    server.listen(env.port, () => {
      logger.info(`Server running on port ${env.port}`);
      logger.info(`API: http://localhost:${env.port}/api`);
    });

    let shuttingDown = false;
    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info(`${signal} received, shutting down gracefully...`);
      deviceStatusUpdater.stop();
      monitoringService.stop();
      backupService.stop();
      activityRecurrenceScheduler.stop();
      quoteExpirationScheduler.stop();
      remotelyPackageIntegrityScheduler.stop();
      glpiStaleDevicesScheduler.stop();
      server.close();

      await shutdownNotificationQueues();
      await eventEmitter.disconnect();
      await closeRedisClient();
      await disconnectPrisma();

      process.exit(0);
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error) {
    logger.error('Failed to start server:', { error: (error as Error).message });
    process.exit(1);
  }
}

startServer();
