import type { Request, Response } from 'express';
import Joi from 'joi';
import { conversationService } from '../services/conversation.service.js';
import { companyService } from '../../companies/services/company.service.js';
import { verifyTurnstileToken } from '../../../shared/security/turnstile.service.js';
import { assertCompanyPublicRateLimit } from '../../../shared/security/company-rate-limit.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { sanitizeConversation } from '../../../shared/utils/mask.js';
import { NIT_FORMAT } from '../../../shared/utils/nit.util.js';

const nitSchema = Joi.string()
  .pattern(NIT_FORMAT)
  .required()
  .messages({ 'string.pattern.base': 'El NIT debe tener solo números (5 a 15 dígitos)' });

const verifyCompanySchema = Joi.object({
  nit: nitSchema,
});

// Mismo criterio que public-ticket.controller.ts: dejar al menos un dato de
// contacto (email o teléfono), aparte del nombre. turnstileToken se exige
// SIEMPRE (ver start() de abajo) — el NIT no es secreto, así que por sí solo
// no prueba que quien escribe tiene algo que ver con esa empresa.
// nombreEmpresa solo se usa si verifyCompany dio "encontrada: false".
const startSchema = Joi.object({
  nit: nitSchema,
  nombreEmpresa: Joi.string().min(2).max(150).empty(''),
  turnstileToken: Joi.string().min(1).required(),
  contactoNombre: Joi.string().min(2).max(150).required(),
  contactoEmail: Joi.string().email({ tlds: false }).empty(''),
  contactoTelefono: Joi.string().min(5).max(30).empty(''),
  mensaje: Joi.string().min(1).required(),
})
  .or('contactoEmail', 'contactoTelefono')
  .messages({ 'object.missing': 'Dejá al menos un dato de contacto: email o teléfono' });

const messageSchema = Joi.object({
  contenido: Joi.string().min(1).required(),
});

export const ConversationPublicController = {
  // Mismo endpoint/criterio que PublicTicketController.verifyCompany — solo
  // confirma existencia + nombre, nada más, sin autenticación. Ya NO tira
  // 404 si no la encuentra (ver comentario ahí).
  async verifyCompany(req: Request, res: Response): Promise<void> {
    const { error, value } = verifyCompanySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const company = await companyService.findByNitForPublicVerification(value.nit);
    res.status(200).json({ data: { encontrada: Boolean(company), company } });
  },

  async start(req: Request, res: Response): Promise<void> {
    const { error, value } = startSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const verified = await verifyTurnstileToken(value.turnstileToken, req.ip);
    if (!verified) throw new AppError('No se pudo verificar que sos una persona real — intentá de nuevo', 422);

    await assertCompanyPublicRateLimit(value.nit);

    const existing = await companyService.findByNitForPublicVerification(value.nit);
    if (!existing && !value.nombreEmpresa) {
      throw new AppError('Falta el nombre de tu empresa', 422);
    }

    const { conversation, token } = await conversationService.startPublic(value);
    // El token SOLO viaja acá, en la respuesta de creación — el widget lo
    // guarda en localStorage. No se puede volver a pedir después.
    res.status(201).json({ data: { conversationId: conversation.id, token } });
  },

  async getByToken(req: Request, res: Response): Promise<void> {
    const conversation = await conversationService.resolveByToken(req.params.token);
    const messages = await conversationService.getMessagesPublic(req.params.token);
    res.status(200).json({ data: { conversation: sanitizeConversation(conversation), messages } });
  },

  async postMessage(req: Request, res: Response): Promise<void> {
    const { error, value } = messageSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const message = await conversationService.postMessagePublic(req.params.token, value.contenido);
    res.status(201).json({ data: message });
  },
};
