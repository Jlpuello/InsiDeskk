import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import Joi from 'joi';
import { ticketService } from '../services/ticket.service.js';
import { ticketCategoryService } from '../services/ticket-category.service.js';
import { slaPolicyService } from '../services/sla-policy.service.js';
import { ticketLevelVisibilityService } from '../services/ticket-level-visibility.service.js';
import { noteRepository } from '../repositories/note.repository.js';
import { resolveEmpresaId, isOwnCompany } from '../../../shared/security/tenant-scope.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { sanitizeNestedDevice } from '../../../shared/utils/mask.js';

const CRITICIDAD_VALUES = ['baja', 'media', 'alta', 'critica'] as const;

const removeSchema = Joi.object({
  motivo: Joi.string().min(5).max(500).required(),
});

// .empty('') trata un string vacío como "no enviado" — un <select> con opción
// "Ninguno" que mande "" (en vez de omitir el campo) no debería romper con un
// 422 confuso sobre formato de UUID.
const createTicketSchema = Joi.object({
  titulo: Joi.string().min(3).max(255).required(),
  descripcion: Joi.string().min(3),
  empresaId: Joi.string().uuid().required(),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica'),
  criticidad: Joi.string().valid(...CRITICIDAD_VALUES),
  categoriaId: Joi.string().uuid().empty(''),
  subcategoriaId: Joi.string().uuid().empty(''),
  dispositivoId: Joi.string().uuid().empty(''),
  usuarioAsignadoId: Joi.string().uuid().empty(''),
  tiempoEstimado: Joi.number().integer().min(0),
  // Quién reportó de verdad (ej. alguien llamó y un admin/técnico registra el
  // ticket a su nombre) — informativo, no reemplaza al usuario autenticado
  // como usuarioReporterId.
  reporterNombre: Joi.string().min(2).max(150).empty(''),
  reporterEmail: Joi.string().email({ tlds: false }).empty(''),
  reporterTelefono: Joi.string().min(5).max(30).empty(''),
});

const updateTicketSchema = Joi.object({
  titulo: Joi.string().min(3).max(255),
  descripcion: Joi.string().min(3).allow(null),
  prioridad: Joi.string().valid('baja', 'media', 'alta', 'critica'),
  criticidad: Joi.string().valid(...CRITICIDAD_VALUES),
  categoriaId: Joi.string().uuid().empty('').allow(null),
  subcategoriaId: Joi.string().uuid().empty('').allow(null),
  dispositivoId: Joi.string().uuid().empty('').allow(null),
  usuarioAsignadoId: Joi.string().uuid().empty('').allow(null),
});

// prioridadDefault/criticidadDefault/nivelRequerido: null explícito borra el
// valor fijado (vuelve a comportamiento libre/sin auto-asignación para esa
// categoría/subcategoría); omitir el campo lo deja como está.
const categorySchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  prioridadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  criticidadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  nivelRequerido: Joi.number().integer().min(1).max(3).allow(null),
});

const categoryUpdateSchema = Joi.object({
  nombre: Joi.string().min(2).max(150),
  activo: Joi.boolean(),
  prioridadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  criticidadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  nivelRequerido: Joi.number().integer().min(1).max(3).allow(null),
});

const subcategorySchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  prioridadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  criticidadDefault: Joi.string().valid(...CRITICIDAD_VALUES).allow(null),
  nivelRequerido: Joi.number().integer().min(1).max(3).allow(null),
});

const slaUpdateSchema = Joi.object({
  tiempoRespuestaMin: Joi.number().integer().min(1).required(),
  tiempoResolucionMin: Joi.number().integer().min(1).required(),
});

const nivelVisibilityUpdateSchema = Joi.object({
  visible: Joi.boolean().required(),
});
const NIVEL_VALUES = [1, 2, 3];

// 'cerrado' queda afuera a propósito: cerrar exige documentar la solución
// (ver closeTicketSchema / TicketController.close), así que este endpoint
// solo mueve entre los estados que no requieren esa documentación.
const statusSchema = Joi.object({
  estado: Joi.string().valid('abierto', 'en_progreso', 'en_espera', 'cancelado').required(),
  // Solo obligatorio al pausar (→ en_espera) — ver ticket.service.ts#changeTicketStatus.
  motivo: Joi.string().min(5).max(500).when('estado', { is: 'en_espera', then: Joi.required() }),
});

const closeTicketSchema = Joi.object({
  contenido: Joi.string().min(3).required(),
});

const reopenTicketSchema = Joi.object({
  motivo: Joi.string().min(3).required(),
});

const noteSchema = Joi.object({
  contenido: Joi.string().min(1).required(),
  tipo: Joi.string().valid('interna', 'cliente', 'sistema'),
});

export const TicketController = {
  async list(req: Request, res: Response): Promise<void> {
    const { empresaId, estado, prioridad, usuarioAsignadoId, categoriaId, skip, take } = req.query as Record<
      string,
      string | undefined
    >;

    const tickets = await ticketService.getTickets(
      empresaId,
      {
        estado: estado as never,
        prioridad: prioridad as never,
        usuarioAsignadoId,
        categoriaId,
      },
      skip ? Number(skip) : undefined,
      take ? Number(take) : undefined,
    );

    res.status(200).json({ data: tickets.map(sanitizeNestedDevice) });
  },

  async stats(req: Request, res: Response): Promise<void> {
    const { empresaId } = req.query as { empresaId?: string };
    const stats = await ticketService.getStats(empresaId);
    res.status(200).json({ data: stats });
  },

  // Gráficos del Dashboard — ver TicketService.getPriorityBreakdown/getTicketTrend.
  async statsByPriority(req: Request, res: Response): Promise<void> {
    const { empresaId } = req.query as { empresaId?: string };
    const stats = await ticketService.getPriorityBreakdown(empresaId);
    res.status(200).json({ data: stats });
  },

  async statsTrend(req: Request, res: Response): Promise<void> {
    const { empresaId } = req.query as { empresaId?: string };
    const stats = await ticketService.getTicketTrend(empresaId, 14);
    res.status(200).json({ data: stats });
  },

  // KPI "Mis tickets" del Dashboard — cuenta del propio usuario logueado,
  // no toma empresaId ni ningún otro filtro por query.
  async myOpenCount(_req: Request, res: Response): Promise<void> {
    const count = await ticketService.getMyOpenTicketsCount();
    res.status(200).json({ data: { count } });
  },

  async getById(req: Request, res: Response): Promise<void> {
    const ticket = await ticketService.getTicketById(req.params.id);
    res.status(200).json({ data: sanitizeNestedDevice(ticket) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = createTicketSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    // El RBAC de Prisma solo filtra lecturas (findMany/findUnique/findFirst) —
    // en un create, un cliente/tecnico podría mandar cualquier empresaId válido
    // si no se fuerza acá. Solo admin puede crear tickets para otra empresa.
    const empresaId = resolveEmpresaId(value.empresaId);
    if (!empresaId) throw new AppError('El usuario no tiene una empresa asociada', 422);

    const usuarioReporterId = req.user!.id;
    const ticket = await ticketService.createTicket({ ...value, empresaId, usuarioReporterId });
    res.status(201).json({ data: sanitizeNestedDevice(ticket) });
  },

  async update(req: Request, res: Response): Promise<void> {
    const { error, value } = updateTicketSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const ticket = await ticketService.updateTicket(req.params.id, value);
    res.status(200).json({ data: sanitizeNestedDevice(ticket) });
  },

  async changeStatus(req: Request, res: Response): Promise<void> {
    const { error, value } = statusSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const ticket = await ticketService.changeTicketStatus(req.params.id, value.estado, { motivo: value.motivo });
    res.status(200).json({ data: sanitizeNestedDevice(ticket) });
  },

  // Borrado — acción crítica, exige motivo (ver ticket.service.ts#deleteTicket).
  async remove(req: Request, res: Response): Promise<void> {
    const { error, value } = removeSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    await ticketService.deleteTicket(req.params.id, value.motivo);
    res.status(204).send();
  },

  // multipart/form-data: 'contenido' (texto, la solución aplicada) + hasta 5
  // archivos en 'imagenes' (ver ticket-upload.middleware.ts, ya validados y
  // guardados en disco para cuando llegamos acá — req.files trae sus nombres
  // generados).
  async close(req: Request, res: Response): Promise<void> {
    const { error, value } = closeTicketSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const adjuntos = files.map((f) => `/tickets/${req.params.id}/attachments/${f.filename}`);

    const ticket = await ticketService.closeTicketWithResolution(req.params.id, {
      contenido: value.contenido,
      adjuntos,
      usuarioId: req.user!.id,
    });

    res.status(200).json({ data: sanitizeNestedDevice(ticket) });
  },

  async reopen(req: Request, res: Response): Promise<void> {
    const { error, value } = reopenTicketSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const ticket = await ticketService.reopenTicket(req.params.id, value.motivo, req.user!.id);
    res.status(200).json({ data: sanitizeNestedDevice(ticket) });
  },

  // Sirve un adjunto de cierre — a diferencia del resto de la API, esto
  // devuelve un archivo binario, no JSON. Chequeo manual de empresa acá (en
  // vez de confiar en el middleware RBAC de Prisma, que no aplica a lecturas
  // de filesystem) — ver shared/security/tenant-scope.ts.
  async getAttachment(req: Request, res: Response): Promise<void> {
    const ticket = await ticketService.getTicketById(req.params.id);
    if (!isOwnCompany(ticket.empresaId)) throw new ForbiddenError('No tenés acceso a este archivo');

    // path.basename descarta cualquier segmento de directorio (ej. "../..") —
    // el nombre real siempre es el UUID+extensión que generó multer.
    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), 'uploads', 'tickets', req.params.id, filename);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Archivo');

    res.sendFile(filePath);
  },

  async listNotes(req: Request, res: Response): Promise<void> {
    const notes = await noteRepository.findByTicketId(req.params.id);
    res.status(200).json({ data: notes });
  },

  async addNote(req: Request, res: Response): Promise<void> {
    const { error, value } = noteSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    await ticketService.assertModifiable(req.params.id);

    const usuarioId = req.user!.id;
    const note = await noteRepository.create({ ticketId: req.params.id, usuarioId, ...value });

    // Primera respuesta de SLA = primera nota visible al cliente. No bloquea
    // la respuesta si algo falla acá (la nota ya se creó bien).
    if (value.tipo === 'cliente') {
      await ticketService.recordFirstResponse(req.params.id);
    }

    res.status(201).json({ data: note });
  },

  async removeNote(req: Request, res: Response): Promise<void> {
    await ticketService.assertModifiable(req.params.id);
    await noteRepository.delete(req.params.id, req.params.noteId);
    res.status(204).send();
  },

  // ── Categorías y subcategorías ──────────────────────────────────────────
  async listCategories(_req: Request, res: Response): Promise<void> {
    const categories = await ticketCategoryService.list();
    res.status(200).json({ data: categories });
  },

  async createCategory(req: Request, res: Response): Promise<void> {
    const { error, value } = categorySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const category = await ticketCategoryService.create(value.nombre, {
      prioridadDefault: value.prioridadDefault,
      criticidadDefault: value.criticidadDefault,
      nivelRequerido: value.nivelRequerido,
    });
    res.status(201).json({ data: category });
  },

  async updateCategory(req: Request, res: Response): Promise<void> {
    const { error, value } = categoryUpdateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const category = await ticketCategoryService.update(req.params.id, value);
    res.status(200).json({ data: category });
  },

  async createSubcategory(req: Request, res: Response): Promise<void> {
    const { error, value } = subcategorySchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const subcategory = await ticketCategoryService.createSubcategory(req.params.id, value.nombre, {
      prioridadDefault: value.prioridadDefault,
      criticidadDefault: value.criticidadDefault,
      nivelRequerido: value.nivelRequerido,
    });
    res.status(201).json({ data: subcategory });
  },

  async updateSubcategory(req: Request, res: Response): Promise<void> {
    const { error, value } = categoryUpdateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const subcategory = await ticketCategoryService.updateSubcategory(req.params.subcategoryId, value);
    res.status(200).json({ data: subcategory });
  },

  // ── SLA ──────────────────────────────────────────────────────────────────
  async listSlaPolicies(_req: Request, res: Response): Promise<void> {
    const policies = await slaPolicyService.list();
    res.status(200).json({ data: policies });
  },

  async updateSlaPolicy(req: Request, res: Response): Promise<void> {
    const { error, value } = slaUpdateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { prioridad, criticidad } = req.params as {
      prioridad: 'baja' | 'media' | 'alta' | 'critica';
      criticidad: 'baja' | 'media' | 'alta' | 'critica';
    };
    if (!CRITICIDAD_VALUES.includes(prioridad) || !CRITICIDAD_VALUES.includes(criticidad)) {
      throw new AppError('Prioridad o criticidad inválida', 422);
    }

    const policy = await slaPolicyService.update(prioridad, criticidad, value);
    res.status(200).json({ data: policy });
  },

  // ── Visibilidad por nivel ────────────────────────────────────────────────
  // Filas ausentes = visible (ver TicketLevelVisibilityService) — a
  // diferencia de listSlaPolicies, esto NO devuelve las 9 combinaciones
  // siempre, el frontend completa lo que falta con "visible: true".
  async listNivelVisibility(_req: Request, res: Response): Promise<void> {
    const rows = await ticketLevelVisibilityService.list();
    res.status(200).json({ data: rows });
  },

  async updateNivelVisibility(req: Request, res: Response): Promise<void> {
    const { error, value } = nivelVisibilityUpdateSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const nivelTecnico = Number(req.params.nivelTecnico);
    const nivelTicket = Number(req.params.nivelTicket);
    if (!NIVEL_VALUES.includes(nivelTecnico) || !NIVEL_VALUES.includes(nivelTicket)) {
      throw new AppError('Nivel inválido — debe ser 1, 2 o 3', 422);
    }

    const row = await ticketLevelVisibilityService.update(nivelTecnico, nivelTicket, value.visible);
    res.status(200).json({ data: row });
  },
};
