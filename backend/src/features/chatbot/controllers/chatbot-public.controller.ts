import type { Request, Response } from 'express';
import { chatbotConfigService } from '../services/chatbot-config.service.js';

export const ChatbotPublicController = {
  // Sin autenticación — la landing de soporte (/soporte) lo usa para armar
  // el bot. null si el admin no lo activó (ver ChatbotConfigService.getForPublic).
  async get(_req: Request, res: Response): Promise<void> {
    const arbol = await chatbotConfigService.getForPublic();
    res.status(200).json({ data: arbol });
  },
};
