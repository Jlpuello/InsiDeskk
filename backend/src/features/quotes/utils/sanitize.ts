// tokenHash es el HMAC del token de aprobación (irreversible, no un secreto
// que se pueda "usar" si se filtra) — igual no hay motivo para devolverlo por
// API, ni siquiera al dueño de la cotización. Mismo criterio que
// remotelyIdHash en sanitizeDevice (shared/utils/mask.ts): es un índice
// interno, no un dato que el frontend necesite.
interface SanitizableQuote {
  tokenHash?: string | null;
  [key: string]: unknown;
}

export function sanitizeQuote<T extends SanitizableQuote>(quote: T): Omit<T, 'tokenHash'> {
  const { tokenHash: _tokenHash, ...rest } = quote;
  return rest;
}
