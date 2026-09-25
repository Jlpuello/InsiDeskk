import type { Request, Response } from 'express';
import Joi from 'joi';
import { chatbotConfigService } from '../services/chatbot-config.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

// Cada opción va a otro nodo (siguienteId) O dispara una acción terminal
// (accion) — nunca ambas, nunca ninguna (si no, el bot no sabría qué hacer
// al hacer click).
const optionSchema = Joi.object({
  texto: Joi.string().min(1).required(),
  siguienteId: Joi.string().min(1),
  accion: Joi.string().valid('crear_ticket', 'hablar_con_agente', 'hablar_con_ia', 'fin'),
}).xor('siguienteId', 'accion');

const nodeSchema = Joi.object({
  mensaje: Joi.string().min(1).required(),
  opciones: Joi.array().items(optionSchema).min(1).required(),
});

const treeSchema = Joi.object({
  root: Joi.string().min(1).required(),
  nodes: Joi.object().pattern(Joi.string().min(1), nodeSchema).min(1).required(),
});

const updateSchema = Joi.object({
  activo: Joi.boolean().required(),
  arbol: treeSchema.required(),
});

export const ChatbotConfigController = {
  async get(_req: Request, res: Response): Promise<void> {
    const config = await chatbotConfigService.getForAdmin();
    res.status(200).json({ data: config });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const config = await chatbotConfigService.update(value.activo, value.arbol, req.user!.id);
    res.status(200).json({ data: config });
  },
};
