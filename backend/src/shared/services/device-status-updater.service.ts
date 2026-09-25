import { RemotelyService } from '../../features/remotely/index.js';
import { logger } from '../utils/logger.js';

// Vive en shared/services (no dentro de features/devices ni features/remotely)
// porque orquesta ambas features sin que ninguna dependa de la otra: solo llama
// a la API pública de RemotelyService, que ya sabe cachear y emitir el evento
// device.status.changed.
export class DeviceStatusUpdaterService {
  private intervalHandle: NodeJS.Timeout | null = null;

  constructor(private readonly remotelyService: RemotelyService = new RemotelyService()) {}

  start(intervalSeconds = 5): void {
    if (this.intervalHandle) return;

    this.intervalHandle = setInterval(() => {
      this.remotelyService.updateDeviceStatusCache().catch((err: Error) => {
        logger.error(`Error actualizando estado de dispositivos: ${err.message}`);
      });
    }, intervalSeconds * 1000);

    logger.info(`Device status updater iniciado (cada ${intervalSeconds}s)`);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      logger.info('Device status updater detenido');
    }
  }
}
