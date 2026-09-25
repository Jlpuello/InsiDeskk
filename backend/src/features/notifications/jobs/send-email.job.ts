import fs from 'node:fs';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import type { SendEmailJobData } from '../types/notification.types.js';

// Sin API key, el job falla explícitamente (dispara los reintentos de Bull)
// en vez de fingir que se mandó — mejor un error visible en el log que un
// "enviado" fantasma que nunca llegó a ningún lado.
const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

async function sendViaSmtp(
  data: SendEmailJobData,
  config: NonNullable<Awaited<ReturnType<typeof platformSettingsService.getEffectiveEmailConfig>>>,
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
  });

  await transport.sendMail({
    from: config.from,
    to: data.to,
    subject: data.subject,
    html: data.body,
    attachments: (data.attachments ?? []).map((a) => ({ filename: a.filename, path: a.path })),
  });
}

// Provee (Resend, default) o SMTP propio (Settings → Email) — sin tocar esa
// pantalla, el comportamiento es exactamente el de siempre (Resend vía env vars).
export async function sendEmailJob(data: SendEmailJobData): Promise<void> {
  const smtpConfig = await platformSettingsService.getEffectiveEmailConfig();
  if (smtpConfig) {
    await sendViaSmtp(data, smtpConfig);
    logger.info(`Email enviado (SMTP) a ${data.to}: "${data.subject}"`);
    return;
  }

  if (!resend) {
    throw new Error('No hay proveedor de email configurado — configurá RESEND_API_KEY o SMTP en Configuración → Email');
  }

  const attachments = (data.attachments ?? []).map((a) => ({
    filename: a.filename,
    content: fs.readFileSync(a.path).toString('base64'),
  }));

  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: data.to,
    subject: data.subject,
    html: data.body,
    ...(attachments.length > 0 && { attachments }),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  logger.info(`Email enviado (Resend) a ${data.to}: "${data.subject}"`);
}
