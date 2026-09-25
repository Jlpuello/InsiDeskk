import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedisClient } from '../../config/redis.js';
import { env } from '../../config/env.js';

// sendCommand es async porque getRedisClient() garantiza la conexión (espera a
// que .connect() resuelva); una vez conectado, las llamadas siguientes son
// inmediatas porque reutilizan el mismo singleton.
function redisStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      const client = await getRedisClient();
      return client.sendCommand(args);
    },
  });
}

// Límite global, respaldado por Redis para que el conteo sea consistente si el
// backend corre en varias instancias.
export const globalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-global:'),
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
});

// Límite más estricto para endpoints de autenticación (login/register/refresh).
export const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-auth:'),
  message: { error: 'Demasiados intentos, intenta de nuevo más tarde' },
});

// El formulario/bot público de tickets (sin login, ver public-ticket.routes.ts)
// queda expuesto sin ninguna otra barrera para el camino de NIT ya
// registrado — límite bajo por IP para desalentar spam/scraping de NITs.
// Ahora que existen caminos que autoprovisionan empresa (NIT no encontrado)
// o usan la empresa por defecto (sin NIT) bajaron de 8 a 4/15min, y se suma
// publicTicketDailyLimiter abajo para el ataque "lento y constante" que un
// límite de solo 15 minutos no frena — ambos se montan encadenados en
// app.ts. Turnstile (ver turnstile.service.ts) es la barrera principal en
// esos dos caminos; este límite es defensa en profundidad.
export const publicTicketLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 4,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-ticket:'),
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
});

// Tope independiente por día — ver comentario de publicTicketLimiter arriba.
export const publicTicketDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-ticket-daily:'),
  message: { error: 'Alcanzaste el máximo de solicitudes por hoy, intenta de nuevo mañana' },
});

// Link de aprobación de cotizaciones (sin login, ver public-quote.routes.ts)
// — el token de 32 bytes ya hace inviable adivinarlo, este límite es defensa
// en profundidad contra fuerza bruta/scraping, no la barrera principal.
export const publicQuoteLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-quote:'),
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
});

// Chat con IA (sin login, ver features/ai/) — cada mensaje tiene un costo
// real (tokens del proveedor), a diferencia del resto de las rutas públicas
// donde el límite es solo anti-spam. Más generoso que tickets por mensaje
// (una conversación de troubleshooting necesita varios turnos), pero con
// tope diario propio para que no se vuelva una factura sorpresa.
export const publicAiChatLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-ai-chat:'),
  message: { error: 'Demasiados mensajes, intenta de nuevo más tarde' },
});

export const publicAiChatDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-ai-chat-daily:'),
  message: { error: 'Alcanzaste el máximo de mensajes por hoy, intenta de nuevo mañana' },
});

// Widget de chat de la landing page (sin login, ver conversation.public.routes.ts)
// — más generoso que publicTicketLimiter porque una conversación real manda
// varios mensajes por sesión, no uno solo.
export const publicConversationLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl-public-conversation:'),
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
});
