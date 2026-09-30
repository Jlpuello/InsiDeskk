import { getRedisClient } from '../../config/redis.js';
import { AppError } from '../utils/error.handler.js';

const WINDOW_SECONDS = 24 * 60 * 60;
const MAX_PER_COMPANY_PER_DAY = 10;

// Límite adicional POR EMPRESA (no solo por IP, ver rate-limiter.ts) — un
// actor humano decidido puede resolver Turnstile manualmente varias veces
// desde IPs distintas; esto frena el hostigamiento dirigido a una empresa
// puntual (tickets o conversaciones repetidas "en su nombre") que ni
// Turnstile ni el límite por IP cubren solos. Comparte presupuesto entre
// tickets y conversaciones a propósito — mismo NIT, mismo abuso potencial.
// Se llama con el NIT ya validado por Joi (solo dígitos), nunca con input
// crudo.
export async function assertCompanyPublicRateLimit(nit: string): Promise<void> {
  const client = await getRedisClient();
  const key = `rl-public-company:${nit}`;
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, WINDOW_SECONDS);
  }
  if (count > MAX_PER_COMPANY_PER_DAY) {
    throw new AppError(
      'Esta empresa alcanzó el máximo de solicitudes públicas por hoy — contactanos por otro medio',
      429,
    );
  }
}
