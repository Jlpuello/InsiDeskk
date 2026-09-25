import type { Request, Response } from 'express';
import Joi from 'joi';
import { teamChannelService } from '../services/team-channel.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const dmSchema = Joi.object({
  userId: Joi.string().uuid().required(),
});

const groupSchema = Joi.object({
  nombre: Joi.string().min(2).max(100).required(),
  miembroIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const messageSchema = Joi.object({
  contenido: Joi.string().min(1).required(),
});

const memberSchema = Joi.object({
  userId: Joi.string().uuid().required(),
});

export const TeamChannelController = {
  async list(req: Request, res: Response): Promise<void> {
    const channels = await teamChannelService.listMine(req.user!.id);
    res.status(200).json({ data: channels });
  },

  async unreadCount(req: Request, res: Response): Promise<void> {
    const count = await teamChannelService.unreadCount(req.user!.id);
    res.status(200).json({ data: { count } });
  },

  async createDm(req: Request, res: Response): Promise<void> {
    const { error, value } = dmSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const channel = await teamChannelService.getOrCreateDm(req.user!.id, value.userId);
    res.status(201).json({ data: channel });
  },

  async createGroup(req: Request, res: Response): Promise<void> {
    const { error, value } = groupSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const channel = await teamChannelService.createGroup(req.user!.id, value.nombre, value.miembroIds);
    res.status(201).json({ data: channel });
  },

  async getMessages(req: Request, res: Response): Promise<void> {
    const messages = await teamChannelService.getMessages(req.params.id, req.user!.id);
    res.status(200).json({ data: messages });
  },

  async postMessage(req: Request, res: Response): Promise<void> {
    const { error, value } = messageSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const message = await teamChannelService.postMessage(req.params.id, req.user!.id, value.contenido);
    res.status(201).json({ data: message });
  },

  async addMember(req: Request, res: Response): Promise<void> {
    const { error, value } = memberSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    await teamChannelService.addMember(req.params.id, req.user!.id, value.userId);
    res.status(204).send();
  },

  async removeMember(req: Request, res: Response): Promise<void> {
    await teamChannelService.removeMember(req.params.id, req.user!.id, req.user!.rol, req.params.userId);
    res.status(204).send();
  },
};
