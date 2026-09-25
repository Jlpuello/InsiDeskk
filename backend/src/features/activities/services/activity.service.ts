import type { ActividadEstado } from '@prisma/client';
import { activityRepository } from '../repositories/activity.repository.js';
import { activityFollowupRepository } from '../repositories/activity-followup.repository.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { getCurrentUser, getCurrentUserId } from '../../../shared/utils/context.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import type { ActivityFilters, CreateActivityDTO, UpdateActivityDTO } from '../types/activity.types.js';

// Solo el técnico asignado (o un admin) puede trabajar una actividad —
// iniciar/completar/cancelar, agregar seguimientos, generar el acta. Si
// todavía no tiene asignado a nadie, queda abierta a cualquier técnico (no
// hay "el asignado" de quién excluir al resto). Export porque ActaService
// necesita el mismo chequeo antes de generar el acta.
export function assertCanManageActivity(activity: { usuarioAsignadoId: string | null }): void {
  const current = getCurrentUser();
  const currentId = getCurrentUserId();
  if (!current || current.rol === 'admin') return;
  if (!activity.usuarioAsignadoId || activity.usuarioAsignadoId === currentId) return;
  throw new ForbiddenError('Solo el técnico asignado puede gestionar esta actividad');
}

export class ActivityService {
  async create(data: CreateActivityDTO) {
    const activity = await activityRepository.create({
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo: data.tipo ?? 'otro',
      empresa: { connect: { id: data.empresaId } },
      ...(data.usuarioAsignadoId && { usuarioAsignado: { connect: { id: data.usuarioAsignadoId } } }),
      ...(data.ticketId && { ticket: { connect: { id: data.ticketId } } }),
      ...(data.dispositivoId && { dispositivo: { connect: { id: data.dispositivoId } } }),
      ...(data.fechaPlaneada && { fechaPlaneada: data.fechaPlaneada }),
    });

    if (data.usuarioAsignadoId) {
      await eventEmitter.emit('activity.assigned', {
        actividadId: activity.id,
        usuarioAsignadoId: data.usuarioAsignadoId,
        titulo: activity.titulo,
      });
    }

    return activity;
  }

  async list(empresaIdInput: string | undefined, filters?: ActivityFilters) {
    const empresaId = resolveEmpresaId(empresaIdInput);
    return activityRepository.findMany({
      ...(empresaId && { empresaId }),
      ...(filters?.estado && { estado: filters.estado }),
      ...(filters?.tipo && { tipo: filters.tipo }),
      ...(filters?.usuarioAsignadoId && { usuarioAsignadoId: filters.usuarioAsignadoId }),
    });
  }

  // Actividad NO pasa por el middleware RBAC de Prisma (a diferencia de
  // Ticket/Device) — sin este chequeo, cualquier admin/tecnico/cliente podía
  // ver/editar actividades de OTRA empresa (incluidos resultados, fotos y
  // actas firmadas) solo con saber o adivinar el id.
  async getById(id: string) {
    const activity = await activityRepository.findById(id);
    if (!activity) throw new NotFoundError('Actividad');
    assertOwnCompanyOrAdmin(activity.empresaId);
    return activity;
  }

  async update(id: string, data: UpdateActivityDTO) {
    const existing = await this.getById(id);
    const activity = await activityRepository.update(id, {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(data.tipo && { tipo: data.tipo }),
      ...(data.usuarioAsignadoId !== undefined && {
        usuarioAsignado: data.usuarioAsignadoId ? { connect: { id: data.usuarioAsignadoId } } : { disconnect: true },
      }),
      ...(data.ticketId !== undefined && {
        ticket: data.ticketId ? { connect: { id: data.ticketId } } : { disconnect: true },
      }),
      ...(data.dispositivoId !== undefined && {
        dispositivo: data.dispositivoId ? { connect: { id: data.dispositivoId } } : { disconnect: true },
      }),
      ...(data.fechaPlaneada !== undefined && { fechaPlaneada: data.fechaPlaneada }),
    });

    // Solo si realmente cambió a alguien nuevo — evitar renotificar en cada
    // update() que no toca la asignación (ej. solo cambiar la descripción).
    if (data.usuarioAsignadoId && data.usuarioAsignadoId !== existing.usuarioAsignadoId) {
      await eventEmitter.emit('activity.assigned', {
        actividadId: activity.id,
        usuarioAsignadoId: data.usuarioAsignadoId,
        titulo: activity.titulo,
      });
    }

    return activity;
  }

  // pendiente/en_progreso/cancelada — "completada" NO se acepta acá (mismo
  // criterio que TicketService.changeTicketStatus con "cerrado"): completar
  // exige documentar qué se hizo, con fotos opcionales, así que siempre pasa
  // por completeActivity. El controller ya excluye "completada" del schema
  // de validación de este endpoint.
  async changeStatus(id: string, estado: ActividadEstado) {
    const existing = await this.getById(id);
    assertCanManageActivity(existing);

    if (existing.estado === 'completada' || existing.estado === 'cancelada') {
      throw new AppError('La actividad ya está en un estado final', 422);
    }

    return activityRepository.update(id, { estado });
  }

  // Único camino para completar una actividad — exige `resultado` (qué se
  // hizo) con hasta 5 fotos de evidencia opcionales. Es un registro aparte
  // del acta de entrega: el acta, si se genera después, reusa este texto en
  // vez de volver a pedirlo (ver ActaService.createActa).
  async completeActivity(id: string, resultado: string, adjuntos: string[]) {
    const existing = await this.getById(id);
    assertCanManageActivity(existing);

    if (existing.estado === 'completada' || existing.estado === 'cancelada') {
      throw new AppError('La actividad ya está en un estado final', 422);
    }

    return activityRepository.update(id, {
      estado: 'completada',
      fechaCompletada: new Date(),
      resultado: resultado.trim(),
      resultadoAdjuntos: adjuntos,
    });
  }

  async delete(id: string): Promise<void> {
    await this.getById(id);
    await activityRepository.delete(id);
  }

  async addFollowup(actividadId: string, usuarioId: string, contenido: string) {
    const activity = await this.getById(actividadId);
    assertCanManageActivity(activity);
    return activityFollowupRepository.create({ actividadId, usuarioId, contenido });
  }

  async listFollowups(actividadId: string) {
    return activityFollowupRepository.findByActivityId(actividadId);
  }
}

export const activityService = new ActivityService();
