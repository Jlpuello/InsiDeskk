import { Router } from 'express';
import { ConversationController } from './controllers/conversation.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const conversationRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta. Todo el
// feature es admin/tecnico únicamente — un cliente con portal ya tiene
// Tickets, este canal es para gente SIN acceso al portal (ver
// conversation.public.routes.ts).
conversationRoutes.use(authorize('admin', 'tecnico'));

conversationRoutes.get('/', asyncHandler(ConversationController.list));
conversationRoutes.get('/unread-count', asyncHandler(ConversationController.unreadCount));
conversationRoutes.get('/:id/messages', asyncHandler(ConversationController.getMessages));
conversationRoutes.post('/:id/messages', asyncHandler(ConversationController.postMessage));
conversationRoutes.post('/:id/portable-connect-link', asyncHandler(ConversationController.sendPortableConnectLink));
conversationRoutes.put('/:id/assign', asyncHandler(ConversationController.assign));
conversationRoutes.put('/:id/estado', asyncHandler(ConversationController.setEstado));
