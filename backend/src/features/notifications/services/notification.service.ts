import { QueueService } from '../../../shared/queue/queue.service.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { logger } from '../../../shared/utils/logger.js';
import { sendEmailJob } from '../jobs/send-email.job.js';
import { sendNotificationJob } from '../jobs/send-notification.job.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';
import type {
  NotificationChannel,
  SendEmailJobData,
  SendNotificationJobData,
  TestNotificationInput,
} from '../types/notification.types.js';

const emailQueue = new QueueService<SendEmailJobData>('notifications-email');
const notificationQueue = new QueueService<SendNotificationJobData>('notifications-push');

// Mismas etiquetas que TicketStatus en el frontend (ver
// features/tickets/components/TicketList.tsx) — duplicado a propósito, este
// mensaje es texto plano que se guarda en la notificación, no vale la pena
// acoplar el backend al enum de presentación del frontend por esto.
const ESTADO_LABELS: Record<string, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  esperando_aprobacion: 'Esperando aprobación',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

emailQueue.process(sendEmailJob);
notificationQueue.process(sendNotificationJob);

export class NotificationService {
  async queueEmail(data: SendEmailJobData): Promise<string> {
    const job = await emailQueue.addJob(data);
    return String(job.id);
  }

  // A diferencia de queueEmail (fire-and-forget), esto espera a que el job
  // realmente termine — job.finished() de Bull no resuelve hasta agotar los
  // reintentos configurados (ver QueueService: 3 intentos, backoff
  // exponencial). Para casos donde el llamador necesita saber si el envío
  // salió bien de verdad antes de, por ejemplo, marcar un documento como
  // "enviado" (ver ActaService.sendByEmail) — sin esto, quedaría marcado
  // como enviado aunque el job fallara en segundo plano.
  async queueEmailAndWait(data: SendEmailJobData): Promise<void> {
    const job = await emailQueue.addJob(data);
    await job.finished();
  }

  async queueNotification(data: SendNotificationJobData): Promise<string> {
    const job = await notificationQueue.addJob(data);
    return String(job.id);
  }

  async sendTest(input: TestNotificationInput): Promise<string> {
    if (input.channel === 'email') {
      return this.queueEmail({ to: input.to, subject: 'Notificación de prueba', body: input.message });
    }
    return this.queueNotification({
      userId: input.to,
      title: 'Notificación de prueba',
      message: input.message,
      channel: input.channel,
    });
  }

  async getJobStatus(jobId: string, channel: NotificationChannel): Promise<string | null> {
    const queue = channel === 'email' ? emailQueue : notificationQueue;
    return queue.getJobStatus(jobId);
  }

  // ── Campanita del nav ("mis" notificaciones) ─────────────────────────────
  async listMine(usuarioId: string, skip: number, take: number) {
    return notificationRepository.findForUser(usuarioId, skip, take);
  }

  async unreadCount(usuarioId: string): Promise<number> {
    return notificationRepository.countUnread(usuarioId);
  }

  async markRead(id: string, usuarioId: string): Promise<void> {
    const count = await notificationRepository.markRead(id, usuarioId);
    if (count === 0) throw new NotFoundError('Notificación');
  }

  async markAllRead(usuarioId: string): Promise<void> {
    await notificationRepository.markAllRead(usuarioId);
  }
}

// Suscribe la feature a eventos de dominio emitidos por otras features (tickets,
// remotely) para disparar notificaciones sin que notifications dependa de ellas.
export function registerNotificationListeners(): void {
  const service = new NotificationService();

  void eventEmitter.on('ticket.created', async (payload) => {
    // Ticket del formulario público (sin cuenta): no hay a quién notificar
    // in-app, así que se confirma por correo si dejó uno. Best-effort — no
    // debe poder tumbar la creación del ticket si el envío falla.
    if (!payload.usuarioReporterId) {
      if (payload.reporterEmail) {
        await service.queueEmail({
          to: payload.reporterEmail,
          subject: 'Recibimos tu ticket',
          body: `Hola ${payload.reporterNombre ?? ''},\n\nRecibimos tu ticket "${payload.titulo}" y ya quedó registrado. Te contactaremos por este medio para darle seguimiento.`,
        });
      }
      return;
    }

    await service.queueNotification({
      userId: payload.usuarioReporterId,
      title: 'Ticket creado',
      message: `Tu ticket "${payload.titulo}" fue registrado correctamente`,
      channel: 'in_app',
      link: `/tickets/${payload.ticketId}`,
    });
  });

  void eventEmitter.on('ticket.assigned', async (payload) => {
    await service.queueNotification({
      userId: payload.usuarioAsignadoId,
      title: 'Ticket asignado',
      message: `Se te asignó el ticket "${payload.titulo}"`,
      channel: 'in_app',
      link: `/tickets/${payload.ticketId}`,
    });
  });

  // A diferencia de ticket.created/ticket.assigned (un solo destinatario
  // fijo), acá puede haber hasta dos: el reporter y el técnico asignado —
  // salvo quien disparó el cambio (actorId), que no necesita que le avisen de
  // algo que acaba de hacer él mismo.
  void eventEmitter.on('ticket.status.changed', async (payload) => {
    const destinatarios = new Set([payload.usuarioReporterId, payload.usuarioAsignadoId].filter((id): id is string => !!id));
    if (payload.actorId) destinatarios.delete(payload.actorId);

    for (const userId of destinatarios) {
      await service.queueNotification({
        userId,
        title: 'Estado del ticket actualizado',
        message: `"${payload.titulo}" cambió de estado: ahora está ${ESTADO_LABELS[payload.estado] ?? payload.estado}`,
        channel: 'in_app',
        link: `/tickets/${payload.ticketId}`,
      });
    }
  });

  void eventEmitter.on('quote.sent', async (payload) => {
    await service.queueNotification({
      userId: payload.aprobadorId,
      title: 'Cotización para aprobar',
      message: `Tenés una cotización pendiente de tu autorización en "${payload.ticketTitulo}"`,
      channel: 'in_app',
      link: `/tickets/${payload.ticketId}`,
    });
  });

  void eventEmitter.on('quote.resolved', async (payload) => {
    const labels: Record<typeof payload.estado, string> = {
      aprobado: 'aprobada',
      rechazado: 'rechazada',
      expirado: 'expiró sin resolverse',
    };
    await service.queueNotification({
      userId: payload.creadoPorId,
      title: 'Cotización resuelta',
      message: `La cotización del ticket "${payload.ticketTitulo}" fue ${labels[payload.estado]}`,
      channel: 'in_app',
      link: `/tickets/${payload.ticketId}`,
    });
  });

  void eventEmitter.on('device.status.changed', async (payload) => {
    logger.info(
      `Evento device.status.changed recibido: dispositivo ${payload.deviceId} ${payload.previousStatus} → ${payload.newStatus}`,
    );
  });

  logger.info('Listeners de notificaciones registrados');
}

export async function shutdownNotificationQueues(): Promise<void> {
  await Promise.all([emailQueue.close(), notificationQueue.close()]);
}
