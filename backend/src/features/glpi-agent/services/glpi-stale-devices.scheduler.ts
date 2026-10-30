import { CronJob } from 'cron';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { deviceRepository } from '../../devices/index.js';

let job: CronJob | null = null;

// Mismo patrón que quote-expiration.scheduler.ts. GLPI Agent no tiene un
// poller en vivo como Remotely (solo reporta cuando corre) — sin este
// barrido periódico, un equipo apagado se queda marcado "online" para
// siempre, porque nada vuelve a evaluarlo después de su último inventario.
export const glpiStaleDevicesScheduler = {
  start(): void {
    if (job) return;

    job = new CronJob(env.glpiStaleDevicesCron, () => {
      void glpiStaleDevicesScheduler.run();
    });
    job.start();

    logger.info(`Scheduler de equipos GLPI inactivos iniciado (cron: "${env.glpiStaleDevicesCron}")`);
  },

  async run(): Promise<void> {
    try {
      const threshold = new Date(Date.now() - env.glpiStaleDevicesHours * 60 * 60 * 1000);
      const count = await deviceRepository.markStaleGlpiDevicesOffline(threshold);
      if (count > 0) {
        logger.info(`${count} equipo(s) de GLPI Agent marcado(s) como offline por inactividad`);
      }
    } catch (err) {
      logger.error(`Error revisando equipos GLPI inactivos: ${(err as Error).message}`);
    }
  },

  stop(): void {
    if (job) {
      job.stop();
      job = null;
      logger.info('Scheduler de equipos GLPI inactivos detenido');
    }
  },
};
