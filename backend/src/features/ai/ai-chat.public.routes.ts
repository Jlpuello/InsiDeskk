import { Router } from 'express';
import { AiChatPublicController } from './controllers/ai-chat-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Sin verifyJWT — lo usa el widget flotante de /soporte. Rate limitado en
// app.ts (publicAiChatLimiter + publicAiChatDailyLimiter): cada mensaje acá
// tiene un costo real (tokens del proveedor), a diferencia del resto de las
// rutas públicas.
export const aiChatPublicRoutes = Router();

aiChatPublicRoutes.get('/status', asyncHandler(AiChatPublicController.status));
aiChatPublicRoutes.post('/', asyncHandler(AiChatPublicController.chat));
