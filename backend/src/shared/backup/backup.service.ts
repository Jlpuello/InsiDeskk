import { CronJob } from 'cron';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

let job: CronJob | null = null;

// Requiere `pg_dump` en el PATH (viene con el cliente de PostgreSQL). Deshabilitado
// por defecto (BACKUP_ENABLED=false) porque la mayoría de entornos de desarrollo
// no lo tienen instalado; en producción, habilitar junto con un `pg_dump` real.
export const backupService = {
  start(): void {
    if (!env.backupEnabled) {
      logger.info('Backup service deshabilitado (BACKUP_ENABLED=false)');
      return;
    }
    if (job) return;

    fs.mkdirSync(env.backupDir, { recursive: true });

    job = new CronJob(env.backupCron, () => {
      void backupService.runBackup();
    });
    job.start();

    logger.info(`Backup service iniciado (cron: "${env.backupCron}")`);
  },

  async runBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(env.backupDir, `backup-${timestamp}.sql`);

    try {
      await execAsync(`pg_dump "${env.databaseUrl}" -f "${file}"`);
      logger.info(`Backup creado: ${file}`);
    } catch (err) {
      logger.error(`Error creando backup: ${(err as Error).message}`);
    }
  },

  stop(): void {
    if (job) {
      job.stop();
      job = null;
      logger.info('Backup service detenido');
    }
  },
};
