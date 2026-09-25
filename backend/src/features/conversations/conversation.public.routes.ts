import { Router } from 'express';
import { ConversationPublicController } from './controllers/conversation-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Sin verifyJWT — el widget de chat de la landing page (/chat) pega acá
// directo, sin cuenta. Montado en app.ts con su propio rate limiter (ver
// publicConversationLimiter), mismo criterio que publicTicketRoutes.
export const conversationPublicRoutes = Router();

conversationPublicRoutes.get('/verify-company', asyncHandler(ConversationPublicController.verifyCompany));
conversationPublicRoutes.post('/', asyncHandler(ConversationPublicController.start));
conversationPublicRoutes.get('/:token', asyncHandler(ConversationPublicController.getByToken));
conversationPublicRoutes.post('/:token/messages', asyncHandler(ConversationPublicController.postMessage));
