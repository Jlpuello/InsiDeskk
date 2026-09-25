export { conversationRoutes } from './conversation.routes.js';
export { conversationPublicRoutes } from './conversation.public.routes.js';
export { ConversationService, conversationService } from './services/conversation.service.js';
export { registerConversationRealtime } from './services/conversation-realtime.service.js';
export { ConversationRepository, conversationRepository } from './repositories/conversation.repository.js';
export type { Conversation, ConversationMessage, ConversationStatus, ConversationChannel } from '@prisma/client';
