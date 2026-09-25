import type { Request, Response } from 'express';
import Joi from 'joi';
import { NotificationService } from '../services/notification.service.js';
import { AppError } from '../../../shared/utils/AppError.js';

const notificationService = new NotificationService();
const MAX_TAKE = 100;
const DEFAULT_TAKE = 20;

const testSchema = Joi.object({
  channel: Joi.string().valid('email', 'in_app').required(),
  to: Joi.string().required(),
  message: Joi.string().min(1).required(),
});

const listMineQuerySchema = Joi.object({
  skip: Joi.number().integer().min(0),
  take: Joi.number().integer().min(1).max(MAX_TAKE),
});

export const NotificationController = {
  async sendTest(req: Request, res: Response): Promise<void> {
    const { error, value } = testSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const jobId = await notificationService.sendTest(value);
    res.status(202).json({ data: { jobId } });
  },

  async jobStatus(req: Request, res: Response): Promise<void> {
    const channel = req.query.channel as 'email' | 'in_app' | undefined;
    if (!channel) throw new AppError('El parámetro channel es requerido', 422);

    const status = await notificationService.getJobStatus(req.params.jobId, channel);
    res.status(200).json({ data: { status } });
  },

  // ── Campanita del nav ("mis" notificaciones) — cualquier rol autenticado ──
  async listMine(req: Request, res: Response): Promise<void> {
    const { error, value } = listMineQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const { skip = 0, take = DEFAULT_TAKE } = value;
    const { rows, total } = await notificationService.listMine(req.user!.id, skip, take);
    res.status(200).json({ data: rows, total });
  },

  async unreadCount(req: Request, res: Response): Promise<void> {
    const count = await notificationService.unreadCount(req.user!.id);
    res.status(200).json({ data: { count } });
  },

  async markRead(req: Request, res: Response): Promise<void> {
    await notificationService.markRead(req.params.id, req.user!.id);
    res.status(204).send();
  },

  async markAllRead(req: Request, res: Response): Promise<void> {
    await notificationService.markAllRead(req.user!.id);
    res.status(204).send();
  },
};
