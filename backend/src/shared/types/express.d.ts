import type { JwtPayload } from '../auth/jwt.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      // Body crudo del request, capturado por el `verify` de express.json()
      // en app.ts — necesario para validar la firma X-Hub-Signature-256 del
      // webhook de WhatsApp, que se calcula sobre los bytes originales, no
      // sobre el JSON ya parseado (ver features/whatsapp).
      rawBody?: Buffer;
    }
  }
}

export {};
