import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { activityService } from '../services/activity.service.js';
import { activityTemplateService } from '../services/activity-template.service.js';
import { actaService } from '../services/acta.service.js';
import { resolveEmpresaId } from '../../../shared/security/tenant-scope.js';
import { assertDocumentExportAllowed } from '../../../shared/security/permissions.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';

const TIPOS = ['integracion', 'mantenimiento', 'seguimiento', 'otro'] as const;
// 'completada' NO está acá a propósito: completar exige documentar qué se
// hizo (con fotos opcionales), así que solo se acepta por /:id/complete —
// mismo criterio que TicketController con 'cerrado'.
const ESTADOS = ['pendiente', 'en_progreso', 'cancelada'] as const;
const RECURRENCIAS = ['diaria', 'semanal', 'mensual'] as const;

const createActivitySchema = Joi.object({
  titulo: Joi.string().min(3).max(255).required(),
  descripcion: Joi.string().allow(''),
  tipo: Joi.string().valid(...TIPOS),
  empresaId: Joi.string().uuid().required(),
  usuarioAsignadoId: Joi.string().uuid().empty(''),
  ticketId: Joi.string().uuid().empty(''),
  dispositivoId: Joi.string().uuid().empty(''),
  fechaPlaneada: Joi.date().iso(),
});

const updateActivitySchema = Joi.object({
  titulo: Joi.string().min(3).max(255),
  descripcion: Joi.string().allow(null, ''),
  tipo: Joi.string().valid(...TIPOS),
  usuarioAsignadoId: Joi.string().uuid().empty('').allow(null),
  ticketId: Joi.string().uuid().empty('').allow(null),
  dispositivoId: Joi.string().uuid().empty('').allow(null),
  fechaPlaneada: Joi.date().iso().allow(null),
});

const statusSchema = Joi.object({
  estado: Joi.string().valid(...ESTADOS).required(),
  // Solo obligatorio al pausar (en_progreso → pendiente) — ver
  // activity.service.ts#changeStatus.
  motivo: Joi.string().min(5).max(500).when('estado', { is: 'pendiente', then: Joi.required() }),
});

const completeActivitySchema = Joi.object({
  resultado: Joi.string().min(3).required(),
});

const followupSchema = Joi.object({
  contenido: Joi.string().min(1).required(),
});

const templateSchema = Joi.object({
  titulo: Joi.string().min(3).max(255).required(),
  descripcion: Joi.string().allow(''),
  tipo: Joi.string().valid(...TIPOS),
  empresaId: Joi.string().uuid().required(),
  usuarioAsignadoId: Joi.string().uuid().empty(''),
  dispositivoId: Joi.string().uuid().empty(''),
  recurrenciaTipo: Joi.string().valid(...RECURRENCIAS).required(),
  recurrenciaDia: Joi.number().integer().min(0).max(31),
});

const templateUpdateSchema = Joi.object({
  titulo: Joi.string().min(3).max(255),
  descripcion: Joi.string().allow(null, ''),
  usuarioAsignadoId: Joi.string().uuid().empty('').allow(null),
  dispositivoId: Joi.string().uuid().empty('').allow(null),
  recurrenciaTipo: Joi.string().valid(...RECURRENCIAS),
  recurrenciaDia: Joi.number().integer().min(0).max(31).allow(null),
  activo: Joi.boolean(),
});

// Sin 'contenido': el acta reusa actividad.resultado (ver ActaService.createActa)
// en vez de volver a pedir qué se hizo.
const actaSchema = Joi.object({
  firmaNombre: Joi.string().min(2).required(),
});

const sendActaSchema = Joi.object({
  to: Joi.string().email().required(),
});

export const ActivityController = {
  async list(req: Request, res: Response): Promise<void> {
    const { empresaId, estado, tipo, usuarioAsignadoId } = req.query as Record<string, string | undefined>;
    const activities = await activityService.list(empresaId, {
      estado: estado as never,
      tipo: tipo as never,
      usuarioAsignadoId,
    });
    res.status(200).json({ data: activities });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createActivitySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const empresaId = resolveEmpresaId(value.empresaId);
    if (!empresaId) throw new AppError('El usuario no tiene una empresa asociada', 422);

    const activity = await activityService.create({ ...value, empresaId });
    res.status(201).json({ data: activity });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const activity = await activityService.getById(req.params.id);
    res.status(200).json({ data: activity });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateActivitySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const activity = await activityService.update(req.params.id, value);
    res.status(200).json({ data: activity });
  },

  async changeStatus(req: Request, res: Response): Promise<void> {
    const { error, value } = statusSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const activity = await activityService.changeStatus(req.params.id, value.estado, value.motivo);
    res.status(200).json({ data: activity });
  },

  // multipart/form-data: 'resultado' (texto, qué se hizo) + hasta 5 archivos
  // en 'imagenes' (ver completion-upload.middleware.ts).
  async complete(req: Request, res: Response): Promise<void> {
    const { error, value } = completeActivitySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const adjuntos = files.map((f) => `/activities/${req.params.id}/resultado/attachments/${f.filename}`);

    const activity = await activityService.completeActivity(req.params.id, value.resultado, adjuntos);
    res.status(200).json({ data: activity });
  },

  async remove(req: Request, res: Response): Promise<void> {
    await activityService.delete(req.params.id);
    res.status(204).send();
  },

  async listFollowups(req: Request, res: Response): Promise<void> {
    const followups = await activityService.listFollowups(req.params.id);
    res.status(200).json({ data: followups });
  },

  async addFollowup(req: Request, res: Response): Promise<void> {
    const { error, value } = followupSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const followup = await activityService.addFollowup(req.params.id, req.user!.id, value.contenido);
    res.status(201).json({ data: followup });
  },

  // ── Plantillas recurrentes ───────────────────────────────────────────────
  async listTemplates(req: Request, res: Response): Promise<void> {
    const { empresaId } = req.query as { empresaId?: string };
    const templates = await activityTemplateService.list(empresaId);
    res.status(200).json({ data: templates });
  },

  async createTemplate(req: Request, res: Response): Promise<void> {
    const { error, value } = templateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const template = await activityTemplateService.create(value);
    res.status(201).json({ data: template });
  },

  async updateTemplate(req: Request, res: Response): Promise<void> {
    const { error, value } = templateUpdateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const template = await activityTemplateService.update(req.params.id, value);
    res.status(200).json({ data: template });
  },

  // ── Acta de entrega ──────────────────────────────────────────────────────
  // multipart/form-data: 'firmaNombre' (texto) + 'firma' (PNG/JPG, ver
  // signature-upload.middleware.ts).
  async createActa(req: Request, res: Response): Promise<void> {
    const { error, value } = actaSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);
    if (!req.file) throw new AppError('Falta la imagen de la firma', 422);

    const firmaImagenPath = `/activities/${req.params.id}/acta/signature/${req.file.filename}`;
    const acta = await actaService.createActa(req.params.id, {
      firmaNombre: value.firmaNombre,
      firmaImagenPath,
      creadoPorId: req.user!.id,
    });
    res.status(201).json({ data: acta });
  },

  async sendActa(req: Request, res: Response): Promise<void> {
    const { error, value } = sendActaSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const acta = await actaService.sendByEmail(req.params.actaId, value.to);
    res.status(200).json({ data: acta });
  },

  // Firma y PDF sirven un archivo binario — el chequeo de empresa ya lo hace
  // activityService.getById (ver shared/security/tenant-scope.ts), así que
  // alcanza con llamarlo antes de tocar el filesystem.
  async getSignature(req: Request, res: Response): Promise<void> {
    await activityService.getById(req.params.id);

    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'uploads', 'actas', req.params.id, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Archivo');

    res.sendFile(filePath);
  },

  async getResultadoAttachment(req: Request, res: Response): Promise<void> {
    await activityService.getById(req.params.id);

    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'uploads', 'activities', req.params.id, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Archivo');

    res.sendFile(filePath);
  },

  async getActaPdf(req: Request, res: Response): Promise<void> {
    const activity = await activityService.getById(req.params.id);
    await assertDocumentExportAllowed();

    if (!activity.acta?.pdfPath || !fs.existsSync(activity.acta.pdfPath)) {
      throw new NotFoundError('PDF del acta');
    }

    res.sendFile(activity.acta.pdfPath);
  },
};
