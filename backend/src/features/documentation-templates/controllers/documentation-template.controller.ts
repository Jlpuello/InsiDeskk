import type { Request, Response } from 'express';
import Joi from 'joi';
import { documentationTemplateService } from '../services/documentation-template.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const CONTEXTOS = ['cierre_ticket', 'completar_actividad', 'motivo_pausa'] as const;

const createSchema = Joi.object({
  titulo: Joi.string().min(2).max(150).required(),
  contenido: Joi.string().min(3).max(2000).required(),
  contextos: Joi.array().items(Joi.string().valid(...CONTEXTOS)).min(1).required(),
});

const updateSchema = Joi.object({
  titulo: Joi.string().min(2).max(150),
  contenido: Joi.string().min(3).max(2000),
  contextos: Joi.array().items(Joi.string().valid(...CONTEXTOS)).min(1),
  activo: Joi.boolean(),
});

const listQuerySchema = Joi.object({
  contexto: Joi.string().valid(...CONTEXTOS),
});

export const DocumentationTemplateController = {
  async list(req: Request, res: Response): Promise<void> {
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const templates = await documentationTemplateService.list(value.contexto);
    res.status(200).json({ data: templates });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const template = await documentationTemplateService.create(value);
    res.status(201).json({ data: template });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const template = await documentationTemplateService.update(req.params.id, value);
    res.status(200).json({ data: template });
  },
};
