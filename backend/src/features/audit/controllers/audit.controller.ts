import type { Request, Response } from 'express';
import Joi from 'joi';
import { auditService } from '../services/audit.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const MAX_TAKE = 100;
const DEFAULT_TAKE = 50;

const logsQuerySchema = Joi.object({
  usuarioId: Joi.string().uuid(),
  accion: Joi.string(),
  tabla: Joi.string(),
  resultado: Joi.string().valid('success', 'failure'),
  soloConMotivo: Joi.boolean(),
  desde: Joi.date().iso(),
  hasta: Joi.date().iso(),
  skip: Joi.number().integer().min(0),
  take: Joi.number().integer().min(1).max(MAX_TAKE),
});

const failedLoginsQuerySchema = Joi.object({
  email: Joi.string(),
  ipAddress: Joi.string(),
  desde: Joi.date().iso(),
  hasta: Joi.date().iso(),
  skip: Joi.number().integer().min(0),
  take: Joi.number().integer().min(1).max(MAX_TAKE),
});

export const AuditController = {
  async listLogs(req: Request, res: Response): Promise<void> {
    const { error, value } = logsQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const { skip = 0, take = DEFAULT_TAKE, ...filters } = value;
    const { data, total } = await auditService.listLogs(filters, skip, take);
    res.status(200).json({ data, total });
  },

  async listAcciones(_req: Request, res: Response): Promise<void> {
    const data = await auditService.listAcciones();
    res.status(200).json({ data });
  },

  async listTablas(_req: Request, res: Response): Promise<void> {
    const data = await auditService.listTablas();
    res.status(200).json({ data });
  },

  async listFailedLogins(req: Request, res: Response): Promise<void> {
    const { error, value } = failedLoginsQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const { skip = 0, take = DEFAULT_TAKE, ...filters } = value;
    const { data, total } = await auditService.listFailedLogins(filters, skip, take);
    res.status(200).json({ data, total });
  },
};
