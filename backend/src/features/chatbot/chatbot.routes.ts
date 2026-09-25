import { Router } from 'express';
import { ChatbotConfigController } from './controllers/chatbot-config.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const chatbotRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta —
// configurar el árbol del bot es 100% administrativo.
chatbotRoutes.use(authorize('admin'));

chatbotRoutes.get('/config', asyncHandler(ChatbotConfigController.get));
chatbotRoutes.put('/config', asyncHandler(ChatbotConfigController.update));
