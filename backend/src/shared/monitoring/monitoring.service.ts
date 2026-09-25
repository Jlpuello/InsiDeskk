import client from 'prom-client';
import { getPrismaClient } from '../prisma/client.js';
import { logger } from '../utils/logger.js';

export const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });

export const failedLoginCounter = new client.Counter({
  name: 'auth_failed_login_attempts_total',
  help: 'Intentos de login fallidos',
  registers: [metricsRegistry],
});

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const FAILED_LOGIN_ALERT_THRESHOLD = 10;

let intervalHandle: NodeJS.Timeout | null = null;

// Placeholder deliberadamente simple: cuenta FailedLoginAttempt recientes y
// loguea una alerta si pasa el umbral. Para producción real, esto debería
// exportar a un sistema de alertas (PagerDuty, Slack, etc.) en vez de logs.
export const monitoringService = {
  async getMetrics(): Promise<string> {
    return metricsRegistry.metrics();
  },

  getMetricsContentType(): string {
    return metricsRegistry.contentType;
  },

  monitorSecurityMetrics(): void {
    if (intervalHandle) return;

    intervalHandle = setInterval(() => {
      void (async () => {
        try {
          const since = new Date(Date.now() - CHECK_INTERVAL_MS);
          const count = await getPrismaClient().failedLoginAttempt.count({
            where: { createdAt: { gte: since } },
          });

          if (count >= FAILED_LOGIN_ALERT_THRESHOLD) {
            logger.warn(
              `${count} intentos de login fallidos en los últimos ${CHECK_INTERVAL_MS / 60000} minutos`,
            );
          }
        } catch (err) {
          logger.error(`Error monitoreando métricas de seguridad: ${(err as Error).message}`);
        }
      })();
    }, CHECK_INTERVAL_MS);

    logger.info('Monitoreo de seguridad iniciado');
  },

  stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  },
};
