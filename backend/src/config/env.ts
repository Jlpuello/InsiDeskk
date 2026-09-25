import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Falta la variable de entorno requerida: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),

  databaseUrl: required('DATABASE_URL'),

  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  jwtRefreshSecret: required('JWT_REFRESH_SECRET', required('JWT_SECRET')),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',

  remotelyServerUrl: process.env.REMOTELY_SERVER_URL ?? '',
  remotelyApiKey: process.env.REMOTELY_API_KEY ?? '',
  remotelyOrganizationId: process.env.REMOTELY_ORGANIZATION_ID ?? '',

  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  // Base para armar links que se mandan por email (aprobación de
  // cotizaciones) — separado de corsOrigin porque ese puede ser una lista.
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // URL pública por la que ESTE backend es alcanzable desde un equipo
  // cliente recién instalado (no un navegador autenticado) — la usa
  // harden-agent.script.ts para reportar a POST
  // /api/public/remotely/harden-report si el endurecimiento se aplicó bien.
  // Vacío = el paso de reporte se omite al generar el .bat (el endurecimiento
  // en sí igual se aplica, solo no queda registrado en el dispositivo). Ver
  // agent-deploy.util.ts.
  apiPublicUrl: process.env.API_PUBLIC_URL ?? '',

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),

  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  redisPassword: process.env.REDIS_PASSWORD ?? '',
  redisDb: Number(process.env.REDIS_DB ?? 0),
  redisUrl: process.env.REDIS_URL ?? '',

  cacheTtl: Number(process.env.CACHE_TTL ?? 3600),
  cacheDevicesTtl: Number(process.env.CACHE_DEVICES_TTL ?? 300),
  cacheTicketsTtl: Number(process.env.CACHE_TICKETS_TTL ?? 600),

  queueName: process.env.QUEUE_NAME ?? 'tickets-queue',
  queueWorkers: Number(process.env.QUEUE_WORKERS ?? 2),
  queueConcurrency: Number(process.env.QUEUE_CONCURRENCY ?? 5),

  encryptionKey: process.env.ENCRYPTION_KEY ?? '',

  // Cloudflare Turnstile — secreto del lado del servidor para validar el
  // token que manda el widget antes de dejar crear un ticket/empresa sin NIT
  // (ver shared/security/turnstile.service.ts). Vacío = ese camino queda
  // deshabilitado (falla cerrado, es un control de seguridad, no algo que
  // se degrada solo) hasta que se configure una cuenta gratis de Cloudflare.
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY ?? '',

  // Token compartido para leer /metrics (Prometheus) — ver app.ts. Vacío =
  // el endpoint queda deshabilitado (falla cerrado), igual que Turnstile.
  metricsToken: process.env.METRICS_TOKEN ?? '',

  backupEnabled: (process.env.BACKUP_ENABLED ?? 'false') === 'true',
  backupCron: process.env.BACKUP_CRON ?? '0 3 * * *',
  backupDir: process.env.BACKUP_DIR ?? './backups',

  // Envío de actas de entrega por correo (ver features/activities/services/acta.service.ts).
  // Vacío en dev = el envío falla con un error claro en vez de fingir que mandó algo.
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'onboarding@resend.dev',

  // Cron que revisa las plantillas de actividades recurrentes y genera la
  // próxima ocurrencia cuando corresponde (ver activity-recurrence.scheduler.ts).
  actividadesCron: process.env.ACTIVIDADES_CRON ?? '0 6 * * *',

  // Cron que revisa cotizaciones pendientes cuyo token de aprobación venció
  // (ver quote-expiration.scheduler.ts) — cada hora, no diario: dejar un
  // ticket "esperando_aprobacion" un día entero después de vencido penaliza
  // de más al equipo técnico.
  quotesExpirationCron: process.env.QUOTES_EXPIRATION_CRON ?? '0 * * * *',

  // Cron que descarga el paquete de auto-actualización del agente de
  // Remotely (Windows) y compara su hash contra el último conocido, para
  // detectar un cambio inesperado en origen (ver
  // remotely-package-integrity.scheduler.ts) — una vez al día alcanza, no es
  // algo que cambie seguido.
  remotelyPackageCheckCron: process.env.REMOTELY_PACKAGE_CHECK_CRON ?? '0 7 * * *',
} as const;
