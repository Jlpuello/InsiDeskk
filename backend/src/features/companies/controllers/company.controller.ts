import type { Request, Response } from 'express';
import Joi from 'joi';
import { companyService } from '../services/company.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

const companySchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  razonSocial: Joi.string().max(200).allow('', null),
  nit: Joi.string().max(30).allow('', null),
  emailContacto: Joi.string().email().allow('', null),
  telefono: Joi.string().max(30).allow('', null),
  direccion: Joi.string().max(255).allow('', null),
  ciudad: Joi.string().max(100).allow('', null),
  pais: Joi.string().max(100).allow('', null),
  contrato: Joi.string().max(255).allow('', null),
  // El <select> del formulario manda "" para "Ninguno" — se normaliza a null
  // más abajo, Joi solo necesita aceptar el string vacío acá.
  remotelyGroupId: Joi.string().allow('', null),
  // Mismo criterio — tag de texto libre que el técnico configura al instalar
  // GLPI Agent (ver features/glpi-agent).
  glpiAgentTag: Joi.string().max(100).allow('', null),
});

const updateSchema = companySchema
  .fork(['nombre'], (s) => s.optional())
  .keys({ activo: Joi.boolean(), verificado: Joi.boolean() });

const deactivateSchema = Joi.object({
  motivo: Joi.string().min(5).max(500).required(),
});

export const CompanyController = {
  async list(_req: Request, res: Response): Promise<void> {
    const companies = await companyService.list();
    res.status(200).json({ data: companies });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const company = await companyService.getById(req.params.id);
    res.status(200).json({ data: company });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = companySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const company = await companyService.create({
      ...value,
      remotelyGroupId: value.remotelyGroupId || null,
      glpiAgentTag: value.glpiAgentTag || null,
    });
    res.status(201).json({ data: company });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const data = { ...value };
    if ('remotelyGroupId' in value) data.remotelyGroupId = value.remotelyGroupId || null;
    if ('glpiAgentTag' in value) data.glpiAgentTag = value.glpiAgentTag || null;
    const company = await companyService.update(req.params.id, data);
    res.status(200).json({ data: company });
  },

  // No hay DELETE real expuesto — ver el comentario en company.service.ts
  // sobre el cascade de Device/Ticket. "Eliminar" en la UI desactiva. Acción
  // crítica: exige motivo (ver company.service.ts#deactivate).
  async deactivate(req: Request, res: Response): Promise<void> {
    const { error, value } = deactivateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const company = await companyService.deactivate(req.params.id, value.motivo);
    res.status(200).json({ data: company });
  },
};
