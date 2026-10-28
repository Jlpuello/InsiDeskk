import type { Request, Response } from 'express';
import Joi from 'joi';
import { conversationService } from '../services/conversation.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { sanitizeConversation } from '../../../shared/utils/mask.js';

const messageSchema = Joi.object({
  contenido: Joi.string().min(1).required(),
});

const assignSchema = Joi.object({
  usuarioAsignadoId: Joi.string().uuid().allow(null).required(),
});

const estadoSchema = Joi.object({
  estado: Joi.string().valid('abierta', 'cerrada').required(),
});

export const ConversationController = {
  async list(req: Request, res: Response): Promise<void> {
    const { estado } = req.query as { estado?: 'abierta' | 'cerrada' };
    const conversations = await conversationService.list(estado);
    res.status(200).json({ data: conversations.map(sanitizeConversation) });
  },

  async unreadCount(_req: Request, res: Response): Promise<void> {
    const count = await conversationService.unreadCount();
    res.status(200).json({ data: { count } });
  },

  async getMessages(req: Request, res: Response): Promise<void> {
    const conversation = await conversationService.getById(req.params.id);
    const messages = await conversationService.getMessages(req.params.id);
    res.status(200).json({ data: { conversation: sanitizeConversation(conversation), messages } });
  },

  async postMessage(req: Request, res: Response): Promise<void> {
    const { error, value } = messageSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const message = await conversationService.postMessageStaff(req.params.id, req.user!.id, value.contenido);
    res.status(201).json({ data: message });
  },

  async sendPortableConnectLink(req: Request, res: Response): Promise<void> {
    const message = await conversationService.sendPortableConnectLink(req.params.id, req.user!.id);
    res.status(201).json({ data: message });
  },

  async assign(req: Request, res: Response): Promise<void> {
    const { error, value } = assignSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const conversation = await conversationService.assign(req.params.id, value.usuarioAsignadoId);
    res.status(200).json({ data: sanitizeConversation(conversation) });
  },

  async setEstado(req: Request, res: Response): Promise<void> {
    const { error, value } = estadoSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const conversation = await conversationService.setEstado(req.params.id, value.estado);
    res.status(200).json({ data: sanitizeConversation(conversation) });
  },
};
