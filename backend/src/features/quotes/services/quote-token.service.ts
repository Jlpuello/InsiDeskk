import crypto from 'node:crypto';
import { encryptionService } from '../../../shared/utils/encryption.js';

// Link de aprobación sin login (ver quotes/README del plan) — mismo criterio
// que una contraseña: se guarda el HASH (acá, blindIndex/HMAC determinístico,
// para poder buscar por él), nunca el token en claro. El token en claro solo
// existe en memoria el momento de generarlo, para mandarlo por email — no se
// puede recuperar después ni siquiera por un admin.
const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 7;

export const quoteTokenService = {
  generate(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = encryptionService.blindIndex(token);
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);
    return { token, tokenHash, expiresAt };
  },

  hash(token: string): string {
    return encryptionService.blindIndex(token);
  },
};
