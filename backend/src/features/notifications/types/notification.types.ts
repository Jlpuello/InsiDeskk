export type NotificationChannel = 'email' | 'in_app';

export interface EmailAttachment {
  filename: string;
  // Ruta absoluta en disco — el job la lee recién al momento de enviar
  // (Bull serializa el payload como JSON, así que no puede viajar un Buffer).
  path: string;
}

export interface SendEmailJobData {
  to: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

export interface SendNotificationJobData {
  userId: string;
  title: string;
  message: string;
  channel: NotificationChannel;
  // Ruta del frontend a la que navega la campanita al hacer click en esta
  // notificación (ej. "/tickets/xxx") — ver Notification.link en schema.prisma.
  link?: string;
}

export interface TestNotificationInput {
  channel: NotificationChannel;
  to: string;
  message: string;
}
