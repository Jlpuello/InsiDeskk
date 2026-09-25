import { Router } from 'express';
import { ChatbotPublicController } from './controllers/chatbot-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

export const chatbotPublicRoutes = Router();

chatbotPublicRoutes.get('/config', asyncHandler(ChatbotPublicController.get));
