import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { quoteService } from '../services/quote.service.js';
import { sanitizeQuote } from '../utils/sanitize.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { assertDocumentExportAllowed } from '../../../shared/security/permissions.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';

const ESTADOS = ['borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'expirado'] as const;

const lineaSchema = Joi.object({
  concepto: Joi.string().min(2).max(200).required(),
  cantidad: Joi.number().positive().required(),
  valorUnitario: Joi.number().min(0).required(),
  porcentajeImpuesto: Joi.number().min(0).max(100),
});

const createSchema = Joi.object({
  ticketId: Joi.string().uuid().required(),
  empresaId: Joi.string().uuid().required(),
  razon: Joi.string().min(3).max(2000).required(),
  lineas: Joi.array().items(lineaSchema).min(1).required(),
});

const updateSchema = Joi.object({
  razon: Joi.string().min(3).max(2000),
  lineas: Joi.array().items(lineaSchema).min(1),
});

const sendSchema = Joi.object({
  contactoAutorizadorId: Joi.string().uuid().required(),
});

const approveSchema = Joi.object({
  firmaNombre: Joi.string().min(2).required(),
});

const rejectSchema = Joi.object({
  nombre: Joi.string().min(2).required(),
  motivo: Joi.string().min(3).max(2000).required(),
});

const listQuerySchema = Joi.object({
  empresaId: Joi.string().uuid(),
  estado: Joi.string().valid(...ESTADOS),
  ticketId: Joi.string().uuid(),
});

export const QuoteController = {
  async list(req: Request, res: Response): Promise<void> {
    const { error, value } = listQuerySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    // cliente/tecnico solo ven lo de su propia empresa — el RBAC de Prisma no
    // cubre Quote (no está en el middleware), así que se fuerza acá.
    const empresaId = resolveEmpresaId(value.empresaId);
    const quotes = await quoteService.list({ ...value, empresaId });
    res.status(200).json({ data: quotes.map(sanitizeQuote) });
  },

  async listByTicket(req: Request, res: Response): Promise<void> {
    const quotes = await quoteService.findByTicketId(req.params.ticketId);
    const first = quotes[0];
    if (first) assertOwnCompanyOrAdmin(first.empresaId, 'No tenés acceso a estas cotizaciones');
    res.status(200).json({ data: quotes.map(sanitizeQuote) });
  },

  async listApprovers(req: Request, res: Response): Promise<void> {
    const empresaId = resolveEmpresaId(req.query.empresaId as string | undefined);
    if (!empresaId) throw new AppError('Falta indicar la empresa', 422);
    const approvers = await quoteService.listApprovers(empresaId);
    res.status(200).json({ data: approvers.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })) });
  },

  async listPendingForMe(req: Request, res: Response): Promise<void> {
    const quotes = await quoteService.getPendingForApprover(req.user!.id);
    res.status(200).json({ data: quotes.map(sanitizeQuote) });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const quote = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(quote.empresaId, 'No tenés acceso a esta cotización');
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const empresaId = resolveEmpresaId(value.empresaId);
    if (!empresaId) throw new AppError('El usuario no tiene una empresa asociada', 422);

    const quote = await quoteService.createDraft({ ...value, empresaId, creadoPorId: req.user!.id });
    res.status(201).json({ data: sanitizeQuote(quote) });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    const quote = await quoteService.updateDraft(req.params.id, value);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    await quoteService.deleteDraft(req.params.id);
    res.status(204).send();
  },

  async send(req: Request, res: Response): Promise<void> {
    const { error, value } = sendSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    const quote = await quoteService.sendForApproval(req.params.id, value.contactoAutorizadorId);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  async cancel(req: Request, res: Response): Promise<void> {
    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    const quote = await quoteService.cancelPending(req.params.id);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  // multipart/form-data: 'firmaNombre' (texto) + 'firma' (PNG/JPG). Canal
  // autenticado del híbrido — el aprobador tiene que ser el
  // contactoAutorizador designado, ver QuoteService.assertCanResolve.
  async approve(req: Request, res: Response): Promise<void> {
    const { error, value } = approveSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);
    if (!req.file) throw new AppError('Falta la imagen de la firma', 422);

    const existing = await quoteService.getById(req.params.id);
    quoteService.assertCanResolve(existing, req.user!.id);

    const firmaImagenPath = `/quotes/${req.params.id}/signature/${req.file.filename}`;
    const quote = await quoteService.approve(req.params.id, {
      firmaNombre: value.firmaNombre,
      firmaImagenPath,
      ip: req.ip ?? 'desconocida',
      userAgent: req.headers['user-agent'],
      usuarioAutenticadoId: req.user!.id,
    });
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  async reject(req: Request, res: Response): Promise<void> {
    const { error, value } = rejectSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const existing = await quoteService.getById(req.params.id);
    quoteService.assertCanResolve(existing, req.user!.id);

    const quote = await quoteService.reject(req.params.id, {
      nombre: value.nombre,
      motivo: value.motivo,
      ip: req.ip ?? 'desconocida',
      userAgent: req.headers['user-agent'],
      usuarioAutenticadoId: req.user!.id,
    });
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  // Firma y PDF sirven un archivo binario — mismo chequeo manual de empresa
  // que ActivityController.getSignature (RBAC de Prisma no aplica a lecturas
  // de filesystem).
  async getSignature(req: Request, res: Response): Promise<void> {
    const quote = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(quote.empresaId, 'No tenés acceso a este archivo');

    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'uploads', 'quotes', req.params.id, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Archivo');

    res.sendFile(filePath);
  },

  async getPdf(req: Request, res: Response): Promise<void> {
    const quote = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(quote.empresaId, 'No tenés acceso a este archivo');
    await assertDocumentExportAllowed();

    if (!quote.pdfPath || !fs.existsSync(quote.pdfPath)) throw new NotFoundError('PDF de la cotización');

    res.sendFile(quote.pdfPath);
  },

  // multipart/form-data: hasta 5 archivos en 'documentos' (ver
  // quote-document-upload.middleware.ts) — cotización del proveedor, ficha
  // técnica, fotos, etc. Solo admin/técnico suben (ver routes), cualquiera de
  // la misma empresa puede verlos/descargarlos.
  async uploadDocuments(req: Request, res: Response): Promise<void> {
    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) throw new AppError('No se recibió ningún archivo', 422);

    const paths = files.map((f) => `/quotes/${req.params.id}/documents/${f.filename}`);
    const quote = await quoteService.addDocuments(req.params.id, paths);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  async removeDocument(req: Request, res: Response): Promise<void> {
    const existing = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(existing.empresaId, 'No tenés acceso a esta cotización');

    const filename = path.basename(req.params.filename);
    const quote = await quoteService.removeDocument(req.params.id, filename);
    res.status(200).json({ data: sanitizeQuote(quote) });
  },

  // Descarga con el nombre ORIGINAL (ver quote-document-upload.middleware.ts:
  // el nombre en disco es "{uuid}__{original}") — a diferencia de firma/PDF,
  // acá sí importa que el navegador sugiera el nombre real al guardar.
  async getDocument(req: Request, res: Response): Promise<void> {
    const quote = await quoteService.getById(req.params.id);
    assertOwnCompanyOrAdmin(quote.empresaId, 'No tenés acceso a este archivo');
    await assertDocumentExportAllowed();

    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'uploads', 'quotes', req.params.id, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Documento');

    const originalName = filename.includes('__') ? filename.split('__').slice(1).join('__') : filename;
    res.download(filePath, originalName);
  },
};
