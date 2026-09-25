import { CronJob } from 'cron';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { quoteService } from './quote.service.js';

let job: CronJob | null = null;

// Mismo patrón que activity-recurrence.scheduler.ts (CronJob de la librería
// "cron", singleton a nivel de módulo). Corre cada hora por defecto
// (QUOTES_EXPIRATION_CRON): busca cotizaciones pendientes cuyo token venció y
// las marca "expirado", reanudando el SLA del ticket asociado.
export const quoteExpirationScheduler = {
  start(): void {
    if (job) return;

    job = new CronJob(env.quotesExpirationCron, () => {
      void quoteExpirationScheduler.run();
    });
    job.start();

    logger.info(`Scheduler de expiración de cotizaciones iniciado (cron: "${env.quotesExpirationCron}")`);
  },

  async run(): Promise<void> {
    try {
      const count = await quoteService.expirePending();
      if (count > 0) {
        logger.info(`${count} cotización(es) marcada(s) como expirada(s)`);
      }
    } catch (err) {
      logger.error(`Error revisando expiración de cotizaciones: ${(err as Error).message}`);
    }
  },

  stop(): void {
    if (job) {
      job.stop();
      job = null;
      logger.info('Scheduler de expiración de cotizaciones detenido');
    }
  },
};
