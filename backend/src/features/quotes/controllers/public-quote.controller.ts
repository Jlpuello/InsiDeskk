import type { Request, Response } from 'express';
import Joi from 'joi';
import { quoteService } from '../services/quote.service.js';
import { sanitizeQuote } from '../utils/sanitize.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const approveSchema = Joi.object({
  firmaNombre: Joi.string().min(2).required(),
});

const rejectSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  motivo: Joi.string().min(3).max(2000).required(),
});

// Canal sin login del híbrido — quien tiene el token (mandado por email al
// contacto autorizador) puede ver y resolver la cotización sin loguearse.
// La identidad se limita a lo que la persona escribe al confirmar (nombre) +
// lo que el servidor captura solo (IP, timestamp, user-agent) — ver
// QuoteService.approve/reject.
export const PublicQuoteController = {
  async getByToken(req: Request, res: Response): Promise<void> {
    const quote = await quoteService.resolveByToken(req.params.token);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  // req.params.id ya viene resuelto por resolveQuoteFromToken (corre antes
  // que el upload) — la ruta de la firma queda idéntica a la del canal
  // autenticado, para que la visualización posterior (siempre por id) la
  // encuentre sin importar qué canal la subió.
  async approve(req: Request, res: Response): Promise<void> {
    const { error, value } = approveSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);
    if (!req.file) throw new AppError('Falta la imagen de la firma', 422);

    const firmaImagenPath = `/quotes/${req.params.id}/signature/${req.file.filename}`;
    const updated = await quoteService.approve(req.params.id, {
      firmaNombre: value.firmaNombre,
      firmaImagenPath,
      ip: req.ip ?? 'desconocida',
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json({ data: sanitizeQuote(updated) });
  },

  async reject(req: Request, res: Response): Promise<void> {
    const { error, value } = rejectSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const quote = await quoteService.resolveByToken(req.params.token);
    const updated = await quoteService.reject(quote.id, {
      nombre: value.nombre,
      motivo: value.motivo,
      ip: req.ip ?? 'desconocida',
      userAgent: req.headers['user-agent'],
    });
    res.status(200).json({ data: sanitizeQuote(updated) });
  },
};
