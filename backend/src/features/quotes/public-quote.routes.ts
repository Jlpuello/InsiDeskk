import { Router } from 'express';
import { PublicQuoteController } from './controllers/public-quote.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { quoteSignatureUpload } from './middleware/quote-signature-upload.middleware.js';
import { resolveQuoteFromToken } from './middleware/resolve-quote-token.middleware.js';

// Sin verifyJWT — el link de aprobación por correo apunta acá (ver
// app.ts, montado con su propio rate-limit en vez del verifyJWT que llevan
// el resto de las rutas de cotizaciones).
export const publicQuoteRoutes = Router();

publicQuoteRoutes.get('/:token', asyncHandler(PublicQuoteController.getByToken));
publicQuoteRoutes.post(
  '/:token/approve',
  asyncHandler(resolveQuoteFromToken),
  quoteSignatureUpload.single('firma'),
  asyncHandler(PublicQuoteController.approve),
);
publicQuoteRoutes.post('/:token/reject', asyncHandler(PublicQuoteController.reject));
