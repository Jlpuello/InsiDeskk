import { getPrismaClient } from '../../../shared/prisma/client.js';
import { logger } from '../../../shared/utils/logger.js';
import type { SendNotificationJobData } from '../types/notification.types.js';

// Entrega real de una notificación in_app: persiste en Notification (ver
// schema.prisma) — la campanita del frontend la lee por polling desde ahí
// (GET /notifications/mine*, ver notification.routes.ts). channel='email' no
// pasa por acá — usa la cola/job de email por separado (queueEmail).
export async function sendNotificationJob(data: SendNotificationJobData): Promise<void> {
  if (data.channel !== 'in_app') {
    logger.warn(`sendNotificationJob recibió un canal no soportado: ${data.channel}`);
    return;
  }

  await getPrismaClient().notification.create({
    data: { usuarioId: data.userId, titulo: data.title, mensaje: data.message, link: data.link },
  });
}
