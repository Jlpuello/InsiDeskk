import type { Request, Response } from 'express';
import Joi from 'joi';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import { aiClientService } from '../services/ai-client.service.js';
import { AI_TOOLS, buildFullSystemPrompt } from '../ai-tools.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { logger } from '../../../shared/utils/logger.js';

const chatSchema = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().min(1).max(4000).required(),
      }),
    )
    .min(1)
    .max(40) // tope de historial — evita mandar un payload gigante en cada request (el frontend lo manda completo cada vez, sin estado del lado del servidor)
    .required(),
});

export const AiChatPublicController = {
  // Sin exponer el resto de la config — el frontend solo necesita saber si
  // mostrar la opción de hablar con el asistente en el árbol.
  async status(_req: Request, res: Response): Promise<void> {
    const config = await platformSettingsService.getEffectiveAiConfig();
    res.status(200).json({ data: { enabled: Boolean(config) } });
  },

  async chat(req: Request, res: Response): Promise<void> {
    const { error, value } = chatSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const config = await platformSettingsService.getEffectiveAiConfig();
    if (!config) throw new AppError('El chat con IA no está disponible en este momento', 422);

    try {
      const result = await aiClientService.chat(config, buildFullSystemPrompt(config.systemPrompt), value.messages, AI_TOOLS);
      res.status(200).json({ data: result });
    } catch (err) {
      // No se propaga el error crudo del proveedor (podría filtrar detalles
      // de la cuenta/la key) — se loggea y se responde con un fallback
      // conversacional en vez de un 500.
      logger.error(`ai-chat: fallo al generar respuesta: ${(err as Error).message}`);
      res.status(200).json({
        data: { text: 'No pude procesar tu mensaje en este momento — ¿querés que te derive con un agente humano?' },
      });
    }
  },
};
