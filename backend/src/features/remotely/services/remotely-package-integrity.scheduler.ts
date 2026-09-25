import crypto from 'node:crypto';
import { CronJob } from 'cron';
import axios from 'axios';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { platformSettingsService, platformSettingsRepository } from '../../settings/index.js';
import { userRepository } from '../../users/index.js';
import { NotificationService } from '../../notifications/index.js';

let job: CronJob | null = null;
const notificationService = new NotificationService();

// El paquete de instalación/auto-actualización de Windows que sirve Remotely
// — confirmado contra el código fuente (ver agent-deploy.util.ts).
const PACKAGE_PATH = '/Content/Remotely-Win-x64.zip';

// Mismo patrón que quote-expiration.scheduler.ts (CronJob de la librería
// "cron", singleton a nivel de módulo). Corre una vez al día por defecto
// (REMOTELY_PACKAGE_CHECK_CRON): descarga el paquete de auto-actualización
// del agente para Windows y compara su hash contra el último conocido
// (guardado en PlatformSettings).
//
// Cubre, desde afuera, el hallazgo "Alto" de la auditoría de seguridad del
// agente Remotely: el propio agente lo instala como SYSTEM sin verificar
// checksum ni firma, así que un cambio en origen (servidor comprometido,
// imagen Docker alterada) es indistinguible para él de una actualización
// legítima. No lo arregla — el fix real requeriría build propio del
// agente — pero avisa a los admins si el paquete cambió sin que nosotros lo
// hayamos actualizado, para que lo verifiquen antes de que se distribuya a
// más equipos.
export const remotelyPackageIntegrityScheduler = {
  start(): void {
    if (job) return;

    job = new CronJob(env.remotelyPackageCheckCron, () => {
      void remotelyPackageIntegrityScheduler.run();
    });
    job.start();

    logger.info(`Monitor de integridad del paquete de Remotely iniciado (cron: "${env.remotelyPackageCheckCron}")`);
  },

  async run(): Promise<void> {
    try {
      const { remotelyServerUrl } = await platformSettingsService.getPublic();
      if (!remotelyServerUrl) return; // Remotely todavía no configurado — nada que chequear.

      const url = remotelyServerUrl.replace(/\/+$/, '') + PACKAGE_PATH;
      const hash = await downloadAndHash(url);

      const settings = await platformSettingsRepository.get();
      const previousHash = settings?.remotelyPackageHash ?? null;

      await platformSettingsRepository.setPackageHash(hash, new Date());

      if (!previousHash) {
        logger.info(`Hash del paquete de Remotely (Windows) registrado por primera vez: ${hash}`);
        return;
      }

      if (previousHash !== hash) {
        logger.warn(`El hash del paquete de Remotely (Windows) cambió: ${previousHash} -> ${hash}`);
        await alertAdmins(previousHash, hash);
      }
    } catch (err) {
      logger.error(`Error verificando integridad del paquete de Remotely: ${(err as Error).message}`);
    }
  },

  stop(): void {
    if (job) {
      job.stop();
      job = null;
      logger.info('Monitor de integridad del paquete de Remotely detenido');
    }
  },
};

// Streaming en vez de cargar el .zip completo en memoria (puede pesar varias
// decenas de MB) — se va hasheando a medida que llega.
async function downloadAndHash(url: string): Promise<string> {
  const response = await axios.get(url, { responseType: 'stream', timeout: 120_000 });

  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    response.data.on('data', (chunk: Buffer) => hash.update(chunk));
    response.data.on('end', () => resolve());
    response.data.on('error', reject);
  });

  return hash.digest('hex');
}

async function alertAdmins(previousHash: string, newHash: string): Promise<void> {
  const admins = await userRepository.findAdmins();
  const message =
    'El paquete de instalación/actualización del agente de Remotely (Windows) cambió de hash sin que ' +
    `lo hayamos actualizado nosotros: ${previousHash.slice(0, 12)}… → ${newHash.slice(0, 12)}…. ` +
    'Verificá en el servidor de Remotely que sea un cambio legítimo antes de que se siga distribuyendo a más equipos.';

  await Promise.all(
    admins.map((admin) =>
      notificationService.queueNotification({
        userId: admin.id,
        title: 'Cambio inesperado en el paquete del agente Remotely',
        message,
        channel: 'in_app',
        link: '/settings',
      }),
    ),
  );

  await Promise.all(
    admins
      .filter((admin) => admin.email)
      .map((admin) =>
        notificationService.queueEmail({
          to: admin.email,
          subject: 'InsiDesk: cambio inesperado en el paquete del agente Remotely',
          body: message,
        }),
      ),
  );
}
