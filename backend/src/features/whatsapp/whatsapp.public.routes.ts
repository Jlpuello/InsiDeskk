import { Router } from 'express';
import { WhatsappPublicController } from './controllers/whatsapp-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Sin verifyJWT — lo llama Meta directamente. GET es el handshake de
// verificación del webhook; POST recibe los mensajes reales, protegido por
// la firma X-Hub-Signature-256 (ver whatsapp-public.controller.ts), no por
// un rate limiter propio — cae bajo el globalLimiter de app.ts, mismo
// criterio que /api/public/chatbot.
export const whatsappPublicRoutes = Router();

whatsappPublicRoutes.get('/webhook', asyncHandler(WhatsappPublicController.verify));
whatsappPublicRoutes.post('/webhook', asyncHandler(WhatsappPublicController.receive));
