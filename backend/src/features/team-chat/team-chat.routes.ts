import { Router } from 'express';
import { TeamChannelController } from './controllers/team-channel.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const teamChatRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta. 100%
// interno — sin ruta pública, a diferencia de conversation.routes.ts.
teamChatRoutes.use(authorize('admin', 'tecnico'));

teamChatRoutes.get('/channels', asyncHandler(TeamChannelController.list));
teamChatRoutes.get('/channels/unread-count', asyncHandler(TeamChannelController.unreadCount));
teamChatRoutes.post('/channels/dm', asyncHandler(TeamChannelController.createDm));
teamChatRoutes.post('/channels', asyncHandler(TeamChannelController.createGroup));
teamChatRoutes.get('/channels/:id/messages', asyncHandler(TeamChannelController.getMessages));
teamChatRoutes.post('/channels/:id/messages', asyncHandler(TeamChannelController.postMessage));
teamChatRoutes.post('/channels/:id/members', asyncHandler(TeamChannelController.addMember));
teamChatRoutes.delete('/channels/:id/members/:userId', asyncHandler(TeamChannelController.removeMember));
