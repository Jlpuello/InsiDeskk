import type { Request, Response } from 'express';
import Joi from 'joi';
import { platformSettingsService } from '../services/platform-settings.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { isValidNitFormat } from '../../../shared/utils/nit.util.js';

// remotelyApiKeyId y remotelyApiKeySecret van siempre juntos: cambiar el ID
// sin un secreto nuevo (o viceversa) no tiene sentido, porque un secreto
// solo es válido para el ID de token con el que se generó.
const updateSchema = Joi.object({
  remotelyServerUrl: Joi.string().uri().allow(''),
  remotelyApiKeyId: Joi.string().min(1),
  remotelyApiKeySecret: Joi.string().min(1),
}).and('remotelyApiKeyId', 'remotelyApiKeySecret');

// whatsappPhoneNumberId y whatsappAccessToken van siempre juntos: un access
// token de Meta solo es válido para el phone number con el que se generó.
const updateWhatsappSchema = Joi.object({
  whatsappPhoneNumberId: Joi.string().min(1).allow(''),
  whatsappBusinessAccountId: Joi.string().min(1).allow(''),
  whatsappAccessToken: Joi.string().min(1),
  whatsappAppSecret: Joi.string().min(1),
  whatsappWebhookVerifyToken: Joi.string().min(1),
}).and('whatsappPhoneNumberId', 'whatsappAccessToken');

// aiProvider y aiApiKey van siempre juntos: una key solo tiene sentido para
// el proveedor con el que se generó.
const updateAiSchema = Joi.object({
  aiProvider: Joi.string().valid('anthropic', 'openai', 'gemini'),
  aiModel: Joi.string().min(1).allow(''),
  aiApiKey: Joi.string().min(1),
  aiEnabled: Joi.boolean(),
  aiSystemPrompt: Joi.string().max(20000).allow(''),
}).and('aiProvider', 'aiApiKey');

const updateDefaultCompanySchema = Joi.object({
  companyId: Joi.string().uuid().allow(null).required(),
});

// smtpHost/smtpUser/smtpPassword no van todos "juntos" con .and() porque el
// admin puede estar completando el resto de los campos sin cambiar la
// contraseña (que nunca se muestra, ver placeholder en el frontend) — la
// combinación mínima para operar la valida getEffectiveEmailConfig(), no Joi.
const updateOrganizationSchema = Joi.object({
  orgRazonSocial: Joi.string().min(2).max(200).allow(''),
  orgNit: Joi.string()
    .allow('')
    .custom((value, helpers) => (value === '' || isValidNitFormat(value) ? value : helpers.error('any.invalid')))
    .messages({ 'any.invalid': 'NIT inválido — solo dígitos, 5 a 15 caracteres' }),
  orgTelefono: Joi.string().min(5).max(30).allow(''),
  orgEmail: Joi.string().email({ tlds: false }).allow(''),
});

// Límites orientativos de largo que Google trunca en el resultado de
// búsqueda (~60 caracteres el título, ~160 la descripción) — no son un
// límite duro real, pero avisan al admin antes de que quede cortado.
const updateSeoSchema = Joi.object({
  seoMetaTitle: Joi.string().max(70).allow(''),
  seoMetaDescription: Joi.string().max(200).allow(''),
  seoMetaKeywords: Joi.string().max(300).allow(''),
});

const updateEmailSchema = Joi.object({
  emailProvider: Joi.string().valid('resend', 'smtp'),
  smtpHost: Joi.string().min(1).allow(''),
  smtpPort: Joi.number().integer().min(1).max(65535),
  smtpUser: Joi.string().min(1).allow(''),
  smtpPassword: Joi.string().min(1),
  smtpFrom: Joi.string().email({ tlds: false }).allow(''),
  smtpSecure: Joi.boolean(),
});

export const PlatformSettingsController = {
  async getRemotely(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getPublic();
    res.status(200).json({ data: settings });
  },

  async updateRemotely(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.update(value, req.user!.id);
    res.status(200).json({ data: settings });
  },

  async getWhatsapp(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getWhatsappPublic();
    res.status(200).json({ data: settings });
  },

  async updateWhatsapp(req: Request, res: Response): Promise<void> {
    const { error, value } = updateWhatsappSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.updateWhatsapp(value, req.user!.id);
    res.status(200).json({ data: settings });
  },

  async getAi(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getAiPublic();
    res.status(200).json({ data: settings });
  },

  async updateAi(req: Request, res: Response): Promise<void> {
    const { error, value } = updateAiSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.updateAi(value, req.user!.id);
    res.status(200).json({ data: settings });
  },

  async getDefaultCompany(_req: Request, res: Response): Promise<void> {
    const data = await platformSettingsService.getDefaultCompany();
    res.status(200).json({ data });
  },

  async updateDefaultCompany(req: Request, res: Response): Promise<void> {
    const { error, value } = updateDefaultCompanySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const data = await platformSettingsService.updateDefaultCompany(value.companyId, req.user!.id);
    res.status(200).json({ data });
  },

  async getOrganization(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getOrganization();
    res.status(200).json({ data: settings });
  },

  async updateOrganization(req: Request, res: Response): Promise<void> {
    const { error, value } = updateOrganizationSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.updateOrganization(value, req.user!.id);
    res.status(200).json({ data: settings });
  },

  async getSeo(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getSeo();
    res.status(200).json({ data: settings });
  },

  async updateSeo(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSeoSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.updateSeo(value, req.user!.id);
    res.status(200).json({ data: settings });
  },

  async getEmail(_req: Request, res: Response): Promise<void> {
    const settings = await platformSettingsService.getEmailPublic();
    res.status(200).json({ data: settings });
  },

  async updateEmail(req: Request, res: Response): Promise<void> {
    const { error, value } = updateEmailSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const settings = await platformSettingsService.updateEmail(value, req.user!.id);
    res.status(200).json({ data: settings });
  },
};
