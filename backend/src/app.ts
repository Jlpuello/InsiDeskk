import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { getPrismaClient } from './shared/prisma/client.js';
import { errorHandler, notFoundHandler } from './shared/middleware/errorHandler.js';
import { verifyJWT } from './shared/middleware/authMiddleware.js';
import {
  globalLimiter,
  publicTicketLimiter,
  publicTicketDailyLimiter,
  publicQuoteLimiter,
  publicConversationLimiter,
  publicAiChatLimiter,
  publicAiChatDailyLimiter,
} from './shared/security/rate-limiter.js';
import { monitoringService } from './shared/monitoring/monitoring.service.js';
import { env } from './config/env.js';

import { authRoutes } from './features/auth/index.js';
import { ticketRoutes, publicTicketRoutes } from './features/tickets/index.js';
import { deviceRoutes } from './features/devices/index.js';
import { userRoutes } from './features/users/index.js';
import { remotelyRoutes, remotelyPublicRoutes } from './features/remotely/index.js';
import { notificationRoutes } from './features/notifications/index.js';
import { settingsRoutes } from './features/settings/index.js';
import { companyRoutes } from './features/companies/index.js';
import { activityRoutes } from './features/activities/index.js';
import { inventoryRoutes } from './features/inventory/index.js';
import { quoteRoutes, publicQuoteRoutes } from './features/quotes/index.js';
import { auditRoutes } from './features/audit/index.js';
import { conversationRoutes, conversationPublicRoutes } from './features/conversations/index.js';
import { teamChatRoutes } from './features/team-chat/index.js';
import { chatbotRoutes, chatbotPublicRoutes } from './features/chatbot/index.js';
import { whatsappPublicRoutes } from './features/whatsapp/index.js';
import { aiChatPublicRoutes } from './features/ai/index.js';

export function createApp(): Application {
  const app = express();

  // Detrás de cualquier proxy/load balancer real (nginx, Cloudflare, etc.)
  // sin esto `req.ip` devuelve la IP del proxy para TODAS las requests — el
  // rate limiting por IP y el chequeo de IP de Turnstile quedan rotos en
  // silencio (todo el tráfico cae en el mismo balde). `1` = confiar en un
  // solo salto de proxy, que es la topología típica (un solo reverse proxy
  // delante del backend); ajustar si hay más de un proxy en cadena.
  app.set('trust proxy', 1);

  // getPrismaClient() engancha el middleware de encryption/audit/RBAC la
  // primera vez que se llama (ver shared/prisma/client.ts) — se llama acá para
  // que quede listo antes de que entre el primer request.
  getPrismaClient();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin.split(','), credentials: true }));

  // Health/metrics quedan afuera del rate limiter global: son para monitoreo
  // externo (uptime checks, Prometheus) y no deberían competir por el mismo cupo.
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });

  app.get('/health/db', async (_req, res) => {
    try {
      await getPrismaClient().$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected' });
    } catch {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  // Protegido por un token compartido, no por JWT (lo scrapea Prometheus, no
  // un usuario logueado). Mismo criterio que Turnstile: falla cerrado si no
  // hay METRICS_TOKEN configurado, en vez de dejar métricas internas
  // (rutas, latencias, conteos) accesibles a cualquiera que encuentre la URL.
  app.get('/metrics', async (req, res) => {
    if (!env.metricsToken || req.get('x-metrics-token') !== env.metricsToken) {
      res.status(env.metricsToken ? 401 : 503).json({
        error: env.metricsToken ? 'Token inválido' : 'METRICS_TOKEN no configurado — /metrics deshabilitado',
      });
      return;
    }
    res.setHeader('Content-Type', monitoringService.getMetricsContentType());
    res.send(await monitoringService.getMetrics());
  });

  app.use(globalLimiter);
  // `verify` guarda el body crudo en req.rawBody — el webhook de WhatsApp
  // necesita esos bytes exactos (no el JSON re-serializado) para validar la
  // firma X-Hub-Signature-256 (ver features/whatsapp). No afecta a nadie más:
  // solo agrega una propiedad, el parseo normal de req.body sigue igual.
  app.use(
    express.json({
      limit: '10mb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Rutas públicas
  app.use('/api/auth', authRoutes);
  // Formulario de tickets sin login (compartido por link) — límite de tasa
  // propio, más estricto que el global, porque queda expuesto sin ninguna
  // otra barrera (ver public-ticket.routes.ts).
  app.use('/api/public/tickets', publicTicketLimiter, publicTicketDailyLimiter, publicTicketRoutes);
  // Link de aprobación de cotizaciones sin login (ver public-quote.routes.ts).
  app.use('/api/public/quotes', publicQuoteLimiter, publicQuoteRoutes);
  // Callback del equipo recién instalado reportando si el endurecimiento del
  // agente se aplicó bien (ver remotely.public.routes.ts) — sin login, igual
  // que los dos anteriores.
  app.use('/api/public/remotely', remotelyPublicRoutes);
  // Widget de chat de la landing page /chat, sin login (ver
  // conversation.public.routes.ts).
  app.use('/api/public/conversations', publicConversationLimiter, conversationPublicRoutes);
  // Árbol del chatbot para la landing de soporte /soporte (ver
  // chatbot.public.routes.ts) — solo lectura, sin PII, cubierto por el
  // globalLimiter de arriba, sin uno propio.
  app.use('/api/public/chatbot', chatbotPublicRoutes);
  // Webhook de WhatsApp Business Cloud API (Meta) — sin login, protegido por
  // firma de request en vez de secreto en la URL (ver features/whatsapp).
  app.use('/api/public/whatsapp', whatsappPublicRoutes);
  // Chat con IA de la landing de soporte (ver features/ai/) — costo real por
  // mensaje, límite propio más el tope diario.
  app.use('/api/public/ai-chat', publicAiChatLimiter, publicAiChatDailyLimiter, aiChatPublicRoutes);

  // Rutas protegidas (requieren JWT)
  app.use('/api/tickets', verifyJWT, ticketRoutes);
  app.use('/api/devices', verifyJWT, deviceRoutes);
  app.use('/api/users', verifyJWT, userRoutes);
  app.use('/api/remotely', verifyJWT, remotelyRoutes);
  app.use('/api/notifications', verifyJWT, notificationRoutes);
  app.use('/api/settings', verifyJWT, settingsRoutes);
  app.use('/api/companies', verifyJWT, companyRoutes);
  app.use('/api/activities', verifyJWT, activityRoutes);
  app.use('/api/inventory', verifyJWT, inventoryRoutes);
  app.use('/api/quotes', verifyJWT, quoteRoutes);
  app.use('/api/audit', verifyJWT, auditRoutes);
  app.use('/api/conversations', verifyJWT, conversationRoutes);
  app.use('/api/team-chat', verifyJWT, teamChatRoutes);
  app.use('/api/chatbot', verifyJWT, chatbotRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
