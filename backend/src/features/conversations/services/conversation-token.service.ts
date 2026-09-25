import crypto from 'node:crypto';
import { encryptionService } from '../../../shared/utils/encryption.js';

// Acceso anónimo a UNA conversación, sin login — mismo criterio que
// features/quotes/services/quote-token.service.ts: se guarda el HASH (acá
// también vía encryptionService.blindIndex, HMAC determinístico para poder
// buscar por él), el token en claro nunca se persiste. A diferencia del link
// de aprobación de cotización (una sola acción, con vencimiento), este token
// vive indefinidamente en el localStorage del navegador del visitante — es
// "volver al mismo chat", no una acción de un solo uso.
const TOKEN_BYTES = 32;

export const conversationTokenService = {
  generate(): { token: string; tokenHash: string } {
    const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = encryptionService.blindIndex(token);
    return { token, tokenHash };
  },

  hash(token: string): string {
    return encryptionService.blindIndex(token);
  },
};
