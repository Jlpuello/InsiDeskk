import type { Ticket, TicketCriticidad, TicketPriority, TicketStatus } from '@prisma/client';
import { ticketRepository } from '../repositories/ticket.repository.js';
import { slaPolicyService } from './sla-policy.service.js';
import { ticketCategoryService } from './ticket-category.service.js';
import { ticketLevelVisibilityService } from './ticket-level-visibility.service.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CacheKeys, CachePatterns } from '../../../shared/cache/cache-keys.js';
import { hashFilters } from '../../../shared/utils/redis.helpers.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { getCurrentUser, getCurrentUserId } from '../../../shared/utils/context.js';
import { recordCriticalAction } from '../../../shared/security/critical-action.service.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { noteRepository } from '../repositories/note.repository.js';
import { ticketHistoryRepository } from '../repositories/ticket-history.repository.js';
import { userRepository } from '../../users/repositories/user.repository.js';
import { isKnownCompanyContact } from '../../../shared/security/contact-verification.js';

export interface CreateTicketDTO {
  titulo: string;
  descripcion?: string;
  empresaId: string;
  // Uno de los dos, nunca ninguno — ver assertHasReporter. usuarioReporterId
  // es el flujo autenticado (admin/técnico/cliente); reporterNombre+contacto
  // es el flujo público sin cuenta (ver public-ticket.controller.ts).
  usuarioReporterId?: string;
  reporterNombre?: string;
  reporterEmail?: string;
  reporterTelefono?: string;
  usuarioAsignadoId?: string;
  dispositivoId?: string;
  prioridad?: TicketPriority;
  criticidad?: TicketCriticidad;
  categoriaId?: string;
  subcategoriaId?: string;
  tiempoEstimado?: number;
}

function assertHasReporter(data: Pick<CreateTicketDTO, 'usuarioReporterId' | 'reporterNombre' | 'reporterEmail' | 'reporterTelefono'>): void {
  if (data.usuarioReporterId) return;
  if (data.reporterNombre && (data.reporterEmail || data.reporterTelefono)) return;
  throw new AppError(
    'Falta identificar quién reporta: un usuario autenticado, o nombre + al menos un contacto (email o teléfono)',
    422,
  );
}

// resolveEmpresaId (shared/security/tenant-scope.ts): el middleware RBAC de
// Prisma (shared/prisma/middleware/rbac.middleware.ts) ya fuerza
// `where.empresaId` para cliente/tecnico a nivel de query — pero el cache no
// pasa por ahí. Si confiáramos en el empresaId que manda el cliente para
// construir la cache key, un tecnico podría pedir `empresaId` de otra
// empresa: Prisma le devolvería igual solo SU empresa (por el middleware),
// pero el resultado quedaría cacheado bajo la key de la empresa ajena,
// filtrando esos datos a quien sí consulte esa empresa después. Por eso la
// key (y el filtro) siempre se resuelven contra el usuario autenticado, no
// contra el input, salvo para admin.

export class TicketService {
  async createTicket(data: CreateTicketDTO): Promise<Ticket> {
    assertHasReporter(data);

    // Si la categoría/subcategoría elegida fija prioridad/criticidad, esa
    // configuración GANA sobre lo que mande el cliente (ver
    // TicketCategoryService.resolveDefaults) — así una categoría como
    // "Impresoras" nunca termina en un ticket crítico aunque el formulario lo
    // permita. Sin categoría, o con una que no fija nada, sigue el
    // comportamiento libre de siempre.
    const defaults = await ticketCategoryService.resolveDefaults(data.categoriaId, data.subcategoriaId);
    const prioridad = defaults?.prioridad ?? data.prioridad ?? 'media';
    const criticidad = defaults?.criticidad ?? data.criticidad ?? 'media';

    // Auto-asignación por nivel (ver TicketCategory.nivelRequerido): si nadie
    // especificó un asignado a mano y la categoría/subcategoría fija un
    // nivel, se busca el técnico ACTIVO de ese nivel con menos tickets
    // abiertos en esta misma empresa. Si no hay ninguno, queda sin asignar
    // como siempre (no es un error, solo no hay a quién repartírselo).
    let usuarioAsignadoId = data.usuarioAsignadoId;
    if (!usuarioAsignadoId && defaults?.nivelRequerido) {
      usuarioAsignadoId = (await this.pickLeastLoadedTechnician(data.empresaId, defaults.nivelRequerido)) ?? undefined;
    }

    // El SLA se calcula UNA vez, al crear, según la matriz Prioridad×Criticidad
    // vigente en ese momento — si más tarde cambian la matriz o la
    // prioridad/criticidad del ticket, la meta ya fijada no se recalcula sola
    // (evitar mover la meta a mitad de camino sin que quede explícito).
    const policy = await slaPolicyService.getPolicy(prioridad, criticidad);
    const now = Date.now();
    const slaRespuestaVence = new Date(now + policy.tiempoRespuestaMin * 60_000);
    const slaResolucionVence = new Date(now + policy.tiempoResolucionMin * 60_000);

    // Solo el flujo público (sin usuarioReporterId) necesita esta señal — el
    // autenticado ya tiene identidad real, contactoVerificado se queda en su
    // default (true).
    const contactoVerificado = data.usuarioReporterId
      ? undefined
      : await isKnownCompanyContact(data.empresaId, data.reporterEmail, data.reporterTelefono);

    const ticket = await ticketRepository.create({
      titulo: data.titulo,
      descripcion: data.descripcion,
      empresa: { connect: { id: data.empresaId } },
      ...(data.usuarioReporterId
        ? { usuarioReporter: { connect: { id: data.usuarioReporterId } } }
        : {
            reporterNombre: data.reporterNombre,
            reporterEmail: data.reporterEmail,
            reporterTelefono: data.reporterTelefono,
            contactoVerificado,
          }),
      ...(usuarioAsignadoId && { usuarioAsignado: { connect: { id: usuarioAsignadoId } } }),
      ...(data.dispositivoId && { dispositivo: { connect: { id: data.dispositivoId } } }),
      ...(data.categoriaId && { categoria: { connect: { id: data.categoriaId } } }),
      ...(data.subcategoriaId && { subcategoria: { connect: { id: data.subcategoriaId } } }),
      prioridad,
      criticidad,
      slaRespuestaVence,
      slaResolucionVence,
      ...(data.tiempoEstimado !== undefined && { tiempoEstimado: data.tiempoEstimado }),
    });

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(data.empresaId));
    await eventEmitter.emit('ticket.created', {
      ticketId: ticket.id,
      usuarioReporterId: ticket.usuarioReporterId,
      reporterNombre: ticket.reporterNombre,
      reporterEmail: ticket.reporterEmail,
      titulo: ticket.titulo,
    });

    if (usuarioAsignadoId) {
      await eventEmitter.emit('ticket.assigned', { ticketId: ticket.id, usuarioAsignadoId, titulo: ticket.titulo });
    }

    logger.info(`Ticket creado: ${ticket.id}`);
    return ticket;
  }

  // Reparto por carga: entre los técnicos activos de ese nivel en la empresa
  // del ticket, elige el que tenga menos tickets NO terminales asignados
  // ahora mismo (empate → el primero que devuelva la consulta). null si no
  // hay ningún técnico activo de ese nivel en esta empresa.
  private async pickLeastLoadedTechnician(empresaId: string, nivel: number): Promise<string | null> {
    const candidates = await userRepository.findByNivelActivo(empresaId, nivel);
    if (candidates.length === 0) return null;

    const loadByUserId = await ticketRepository.countOpenByAssignees(candidates.map((c) => c.id));

    let best = candidates[0];
    let bestLoad = loadByUserId[best.id] ?? 0;
    for (const candidate of candidates.slice(1)) {
      const load = loadByUserId[candidate.id] ?? 0;
      if (load < bestLoad) {
        best = candidate;
        bestLoad = load;
      }
    }
    return best.id;
  }

  async getTickets(
    empresaIdInput: string | undefined,
    filters?: {
      // 'no-cerrado' es un valor especial (no un TicketStatus real) que el
      // frontend manda por default al entrar a la lista — "todo menos
      // cerrado", no un estado puntual. Mismo criterio que "sin-asignar" más
      // abajo: se resuelve acá, no en el schema de validación del controller.
      estado?: TicketStatus | 'no-cerrado';
      prioridad?: TicketPriority;
      usuarioAsignadoId?: string;
      categoriaId?: string;
    },
    skip?: number,
    take?: number,
  ): Promise<Ticket[]> {
    const empresaId = resolveEmpresaId(empresaIdInput);

    // Un técnico puede tener niveles de ticket ocultos por política (ver
    // ticket-level-visibility.service.ts) — se resuelve ANTES de armar la
    // cache key: dos técnicos de distinto nivel (o uno con la política
    // aplicada y otro sin ella) nunca deben compartir una entrada cacheada
    // con resultados distintos (ver el comentario de "multi-tenant" en
    // cache-keys.ts, mismo riesgo que con empresaId).
    const currentUser = getCurrentUser();
    const currentUserId = getCurrentUserId();
    let deniedTicketNiveles: number[] = [];
    if (currentUser?.rol === 'tecnico' && currentUserId) {
      const me = await userRepository.findById(currentUserId);
      if (me?.nivel) {
        deniedTicketNiveles = await ticketLevelVisibilityService.getDeniedTicketNiveles(me.nivel);
      }
    }

    const cacheKey = CacheKeys.ticketsList(
      empresaId ?? 'all',
      hashFilters({ ...filters, skip, take, deniedTicketNiveles }),
    );

    const cached = await cacheService.get<Ticket[]>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // "sin-asignar" es un valor especial (no un UUID real) que el frontend
    // manda para pedir tickets sin técnico asignado — Prisma no tiene un
    // shorthand para "campo es null" dentro de un objeto de filtros armado
    // dinámicamente, así que se resuelve acá.
    const usuarioAsignadoFilter =
      filters?.usuarioAsignadoId === 'sin-asignar' ? { usuarioAsignadoId: null } : filters?.usuarioAsignadoId
        ? { usuarioAsignadoId: filters.usuarioAsignadoId }
        : {};

    // 'no-cerrado': todo menos cerrado, no un estado puntual — ver el
    // comentario en la firma del método.
    const estadoFilter =
      filters?.estado === 'no-cerrado'
        ? { estado: { not: 'cerrado' as TicketStatus } }
        : filters?.estado
          ? { estado: filters.estado }
          : {};

    // El nivel de un ticket sale de su subcategoría, o de la categoría si no
    // tiene subcategoría (mismo criterio de "pisa" que ya usa
    // TicketCategoryService para auto-asignación). Un ticket asignado
    // directamente a ESTE técnico nunca se oculta por esta política — no
    // tiene sentido bloquearlo de su propio trabajo — así que se combina como
    // OR con la condición de nivel; Prisma lo AND-ea con el resto de filtros
    // de arriba (incluido usuarioAsignadoFilter), lo que además resuelve
    // solo, por álgebra booleana, el caso de un técnico filtrando la cola de
    // OTRA persona: ese OR nunca puede ser cierto por el lado de
    // "usuarioAsignadoId = yo", así que ahí la política de nivel aplica igual.
    let nivelWhere = {};
    if (deniedTicketNiveles.length > 0) {
      const nivelDenegado = {
        OR: [
          { subcategoriaId: { not: null }, subcategoria: { nivelRequerido: { in: deniedTicketNiveles } } },
          {
            subcategoriaId: null,
            categoriaId: { not: null },
            categoria: { nivelRequerido: { in: deniedTicketNiveles } },
          },
        ],
      };
      nivelWhere = { OR: [{ usuarioAsignadoId: currentUserId }, { NOT: nivelDenegado }] };
    }

    const tickets = await ticketRepository.findMany(
      {
        ...(empresaId && { empresaId }),
        ...estadoFilter,
        ...(filters?.prioridad && { prioridad: filters.prioridad }),
        ...(filters?.categoriaId && { categoriaId: filters.categoriaId }),
        ...usuarioAsignadoFilter,
        ...nivelWhere,
      },
      skip,
      take,
    );

    await cacheService.set(cacheKey, tickets, env.cacheTicketsTtl);
    return tickets;
  }

  // KPI "Mis tickets" del Dashboard — sin cache: es una sola consulta
  // puntual (indexada por usuarioAsignadoId+estado), personal de quien
  // pregunta, así que cachearla no ahorra nada y sí arriesga mezclar el
  // conteo de un usuario con el de otro si la key no queda bien scopeada
  // (mismo riesgo que ya se resolvió en getTickets).
  async getMyOpenTicketsCount(): Promise<number> {
    const userId = getCurrentUserId();
    if (!userId) return 0;
    return ticketRepository.count({ usuarioAsignadoId: userId, estado: { not: 'cerrado' } });
  }

  async getStats(empresaIdInput?: string): Promise<{ total: number; byEstado: Record<TicketStatus, number> }> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    // Reusa el mismo prefijo que la lista (`ticket:list:{empresaId}:`) para que
    // se invalide junto con ella en cada create/update/changeStatus/delete.
    const cacheKey = CacheKeys.ticketsList(empresaId ?? 'all', 'stats');

    const cached = await cacheService.get<{ total: number; byEstado: Record<TicketStatus, number> }>(cacheKey);
    if (cached) return cached;

    const byEstado = await ticketRepository.countByStatus(empresaId);
    const total = Object.values(byEstado).reduce((sum, count) => sum + count, 0);
    const stats = { total, byEstado };

    await cacheService.set(cacheKey, stats, env.cacheTicketsTtl);
    return stats;
  }

  // Gráfico de barras del Dashboard — mismo cache que getStats (misma key
  // base, se invalida junto con la lista).
  async getPriorityBreakdown(empresaIdInput?: string): Promise<Record<TicketPriority, number>> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    const cacheKey = CacheKeys.ticketsList(empresaId ?? 'all', 'stats-priority');

    const cached = await cacheService.get<Record<TicketPriority, number>>(cacheKey);
    if (cached) return cached;

    const byPrioridad = await ticketRepository.countByPriority(empresaId);
    await cacheService.set(cacheKey, byPrioridad, env.cacheTicketsTtl);
    return byPrioridad;
  }

  // Gráfico de tendencia del Dashboard — rellena con 0 los días sin tickets
  // (countByDay del repositorio solo trae los que sí tuvieron) para que el
  // front siempre reciba exactamente `days` puntos, uno por día, sin huecos.
  async getTicketTrend(empresaIdInput?: string, days = 14): Promise<{ date: string; count: number }[]> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    const cacheKey = CacheKeys.ticketsList(empresaId ?? 'all', `stats-trend-${days}`);

    const cached = await cacheService.get<{ date: string; count: number }[]>(cacheKey);
    if (cached) return cached;

    const rows = await ticketRepository.countByDay(empresaId, days);
    const byDate = new Map(rows.map((r) => [r.date, r.count]));

    const trend: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      trend.push({ date, count: byDate.get(date) ?? 0 });
    }

    await cacheService.set(cacheKey, trend, env.cacheTicketsTtl);
    return trend;
  }

  async getTicketById(id: string) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');
    return ticket;
  }

  // Un ticket cerrado es un registro congelado — nada lo toca (asignación,
  // campos, notas, estado) hasta que se reabra explícitamente con un motivo
  // (ver reopenTicket). "esperando_aprobacion" es el mismo criterio, pero la
  // única salida es que la cotización asociada se resuelva (aprobar/rechazar/
  // expirar) o el técnico la cancele (ver QuoteService) — nunca una edición
  // directa del ticket, que dejaría el estado y el SLA pausado inconsistentes
  // con la cotización que sigue abierta.
  private assertNotLocked(ticket: Ticket): void {
    if (ticket.estado === 'cerrado') {
      throw new AppError('El ticket está cerrado — reabrilo primero para poder modificarlo', 422);
    }
    if (ticket.estado === 'esperando_aprobacion') {
      throw new AppError(
        'El ticket está esperando la aprobación de una cotización — resolvela o cancelala primero',
        422,
      );
    }
  }

  async assertModifiable(id: string): Promise<Ticket> {
    const ticket = await this.getTicketById(id);
    this.assertNotLocked(ticket);
    return ticket;
  }

  // Llamado por QuoteService al enviar una cotización para aprobación — deja
  // registrado a qué estado volver (ver Quote.ticketEstadoPrevio) y marca
  // cuándo empezó la pausa del SLA (ver slaPausadoEn).
  async pauseForApproval(id: string): Promise<Ticket> {
    const ticket = await this.getTicketById(id);
    this.assertNotLocked(ticket);

    const updated = await ticketRepository.update(id, {
      estado: 'esperando_aprobacion',
      slaPausadoEn: new Date(),
    });

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(updated.empresaId));
    await eventEmitter.emit('ticket.status.changed', {
      ticketId: updated.id,
      estado: updated.estado,
      titulo: updated.titulo,
      usuarioReporterId: updated.usuarioReporterId,
      usuarioAsignadoId: updated.usuarioAsignadoId,
      actorId: getCurrentUserId(),
    });
    return updated;
  }

  // Llamado por QuoteService al resolverse la cotización (aprobada, rechazada,
  // expirada o cancelada) — suma el tiempo que estuvo pausado a los
  // vencimientos de SLA (el reloj no corrió durante la espera) y vuelve al
  // estado que tenía antes de pedir la aprobación. Idempotente: si el ticket
  // ya no está esperando_aprobacion (doble-resolución), no hace nada.
  async resumeFromApproval(id: string, revertToEstado: TicketStatus): Promise<Ticket> {
    const ticket = await this.getTicketById(id);
    if (ticket.estado !== 'esperando_aprobacion') return ticket;

    let slaRespuestaVence = ticket.slaRespuestaVence;
    let slaResolucionVence = ticket.slaResolucionVence;
    if (ticket.slaPausadoEn) {
      const pausedMs = Date.now() - ticket.slaPausadoEn.getTime();
      if (slaRespuestaVence && !ticket.primeraRespuestaEn) {
        slaRespuestaVence = new Date(slaRespuestaVence.getTime() + pausedMs);
      }
      if (slaResolucionVence) {
        slaResolucionVence = new Date(slaResolucionVence.getTime() + pausedMs);
      }
    }

    const updated = await ticketRepository.update(id, {
      estado: revertToEstado,
      slaPausadoEn: null,
      slaRespuestaVence,
      slaResolucionVence,
    });

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(updated.empresaId));
    await eventEmitter.emit('ticket.status.changed', {
      ticketId: updated.id,
      estado: updated.estado,
      titulo: updated.titulo,
      usuarioReporterId: updated.usuarioReporterId,
      usuarioAsignadoId: updated.usuarioAsignadoId,
      actorId: getCurrentUserId(),
    });
    return updated;
  }

  async updateTicket(id: string, data: Partial<Omit<CreateTicketDTO, 'empresaId' | 'usuarioReporterId'>>) {
    const existing = await this.getTicketById(id); // 404 antes que Prisma tire P2025 (record not found) como 500
    this.assertNotLocked(existing);

    // Misma regla que en createTicket: si la categoría/subcategoría EFECTIVA
    // del ticket (la nueva si se está cambiando, si no la que ya tenía) fija
    // prioridad/criticidad, esa configuración gana sobre lo que venga en el
    // body — incluso si alguien intenta pisarla a mano sin tocar la
    // categoría. No se recalcula el SLA acá (ver nota en createTicket).
    const effectiveCategoriaId = data.categoriaId !== undefined ? data.categoriaId : existing.categoriaId;
    const effectiveSubcategoriaId = data.subcategoriaId !== undefined ? data.subcategoriaId : existing.subcategoriaId;
    const defaults = await ticketCategoryService.resolveDefaults(effectiveCategoriaId, effectiveSubcategoriaId);
    const prioridad = defaults?.prioridad ?? data.prioridad;
    const criticidad = defaults?.criticidad ?? data.criticidad;

    const ticket = await ticketRepository.update(id, {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.descripcion !== undefined && { descripcion: data.descripcion }),
      ...(prioridad && { prioridad }),
      ...(criticidad && { criticidad }),
      ...(data.usuarioAsignadoId !== undefined && {
        usuarioAsignado: data.usuarioAsignadoId
          ? { connect: { id: data.usuarioAsignadoId } }
          : { disconnect: true },
      }),
      ...(data.dispositivoId !== undefined && {
        dispositivo: data.dispositivoId ? { connect: { id: data.dispositivoId } } : { disconnect: true },
      }),
      ...(data.categoriaId !== undefined && {
        categoria: data.categoriaId ? { connect: { id: data.categoriaId } } : { disconnect: true },
      }),
      ...(data.subcategoriaId !== undefined && {
        subcategoria: data.subcategoriaId ? { connect: { id: data.subcategoriaId } } : { disconnect: true },
      }),
    });

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(ticket.empresaId));
    await eventEmitter.emit('ticket.updated', { ticketId: ticket.id });

    // Solo notifica si la asignación realmente cambió (evita spamear al mismo
    // técnico si el update tocó otro campo y usuarioAsignadoId ya traía el
    // mismo valor).
    if (
      data.usuarioAsignadoId !== undefined &&
      data.usuarioAsignadoId &&
      data.usuarioAsignadoId !== existing.usuarioAsignadoId
    ) {
      await eventEmitter.emit('ticket.assigned', {
        ticketId: ticket.id,
        usuarioAsignadoId: data.usuarioAsignadoId,
        titulo: ticket.titulo,
      });
    }

    return ticket;
  }

  // Botones de flujo (Iniciar/Pausar/Reanudar/Cancelar) — cada transición
  // hacia/desde "en_progreso" ajusta trabajoIniciadoEn/tiempoReal (ver
  // comentario en schema.prisma). "cerrado" NO se acepta acá: el controller
  // ya lo excluye del schema de validación de PATCH /:id/estado — cerrar
  // siempre pasa por closeTicketWithResolution (exige documentar la
  // solución), así que solo esa llama a este método con estado='cerrado'.
  async changeTicketStatus(id: string, estado: TicketStatus, opts?: { resueltoId?: string; motivo?: string }) {
    const existing = await this.getTicketById(id); // 404 antes que Prisma tire P2025 (record not found) como 500
    this.assertNotLocked(existing);

    // Un ticket que nunca se inició (sigue "abierto") no tiene tiempo
    // trabajado que documentar — forzar que pase por "en_progreso" primero
    // evita cierres fantasma sin que nadie haya tocado el problema.
    if (estado === 'cerrado' && existing.estado === 'abierto') {
      throw new AppError('El ticket debe iniciarse (En progreso) antes de poder cerrarse', 422);
    }

    // Pausar exige indicar por qué — mismo criterio que reabrir/eliminar
    // (acciones que interrumpen el flujo normal y necesitan quedar
    // documentadas, no solo el cambio de estado en sí).
    if (estado === 'en_espera' && !opts?.motivo) {
      throw new AppError('Indicá el motivo de la pausa', 422);
    }

    const now = new Date();
    const isTerminal = estado === 'cerrado' || estado === 'cancelado';
    const wasWorking = existing.estado === 'en_progreso' && existing.trabajoIniciadoEn;

    let tiempoReal = existing.tiempoReal ?? 0;
    let trabajoIniciadoEn: Date | null = existing.trabajoIniciadoEn;

    if (wasWorking && estado !== 'en_progreso') {
      const elapsedMin = Math.round((now.getTime() - existing.trabajoIniciadoEn!.getTime()) / 60_000);
      tiempoReal += Math.max(elapsedMin, 0);
      trabajoIniciadoEn = null;
    } else if (estado === 'en_progreso' && existing.estado !== 'en_progreso') {
      trabajoIniciadoEn = now;
    }

    const ticket = await ticketRepository.update(id, {
      estado,
      closedAt: isTerminal ? now : null,
      trabajoIniciadoEn,
      tiempoReal,
      ...(estado === 'cerrado' && opts?.resueltoId && { resuelto: { connect: { id: opts.resueltoId } } }),
    });

    // Igual que reopenTicket: queda dos veces con el mismo texto — como Note
    // (se ve en la vista del ticket) y como TicketHistory (registro
    // estructurado del cambio de estado).
    if (estado === 'en_espera' && opts?.motivo) {
      const usuarioId = getCurrentUserId();
      if (usuarioId) {
        await noteRepository.create({ ticketId: id, usuarioId, contenido: opts.motivo, tipo: 'pausa' });
        await ticketHistoryRepository.create({
          ticketId: id,
          campoModificado: 'estado',
          valorAnterior: existing.estado,
          valorNuevo: estado,
          usuarioId,
          razon: opts.motivo,
        });
      }
    }

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(ticket.empresaId));
    await eventEmitter.emit('ticket.status.changed', {
      ticketId: ticket.id,
      estado: ticket.estado,
      titulo: ticket.titulo,
      usuarioReporterId: ticket.usuarioReporterId,
      usuarioAsignadoId: ticket.usuarioAsignadoId,
      actorId: getCurrentUserId(),
    });

    return ticket;
  }

  // Único camino para cerrar un ticket (ver nota en changeTicketStatus) —
  // exige documentar qué se hizo (nota tipo "cierre", con fotos opcionales)
  // antes de mover el estado, y de paso registra quién lo resolvió.
  async closeTicketWithResolution(
    id: string,
    input: { contenido: string; adjuntos: string[]; usuarioId: string },
  ): Promise<Ticket> {
    const existing = await this.getTicketById(id);
    // Misma validación que changeTicketStatus, repetida ACÁ antes de crear la
    // nota — si dejáramos que changeTicketStatus la tire, quedaría una nota
    // de cierre huérfana en un ticket que en realidad no se cerró.
    if (existing.estado === 'abierto') {
      throw new AppError('El ticket debe iniciarse (En progreso) antes de poder cerrarse', 422);
    }

    await noteRepository.create({
      ticketId: id,
      usuarioId: input.usuarioId,
      contenido: input.contenido,
      tipo: 'cierre',
      adjuntos: input.adjuntos,
    });

    return this.changeTicketStatus(id, 'cerrado', { resueltoId: input.usuarioId });
  }

  // Única forma de sacar un ticket de "cerrado" — vuelve a "abierto" (hay que
  // Iniciar de nuevo para retomar el cronómetro, mismo criterio que un
  // ticket nuevo) y dispara directo el update en vez de pasar por
  // changeTicketStatus (que ahora bloquea cualquier transición si el estado
  // ACTUAL es cerrado — reabrir es justamente la excepción a esa regla).
  // El motivo queda registrado dos veces con el mismo texto: como Note
  // (aparece en la vista y en el informe, "para plasmarlo en el ticket") y
  // como TicketHistory (registro estructurado del cambio de estado).
  async reopenTicket(id: string, motivo: string, usuarioId: string): Promise<Ticket> {
    const existing = await this.getTicketById(id);
    if (existing.estado !== 'cerrado') {
      throw new AppError('Solo se puede reabrir un ticket cerrado', 422);
    }

    await noteRepository.create({
      ticketId: id,
      usuarioId,
      contenido: motivo,
      tipo: 'reapertura',
    });

    await ticketHistoryRepository.create({
      ticketId: id,
      campoModificado: 'estado',
      valorAnterior: 'cerrado',
      valorNuevo: 'abierto',
      usuarioId,
      razon: motivo,
    });

    const ticket = await ticketRepository.update(id, {
      estado: 'abierto',
      closedAt: null,
      resuelto: { disconnect: true },
    });

    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(ticket.empresaId));
    await eventEmitter.emit('ticket.status.changed', {
      ticketId: ticket.id,
      estado: ticket.estado,
      titulo: ticket.titulo,
      usuarioReporterId: ticket.usuarioReporterId,
      usuarioAsignadoId: ticket.usuarioAsignadoId,
      actorId: getCurrentUserId(),
    });

    return ticket;
  }

  // Se llama después de crear una Note tipo "cliente" — marca la primera
  // respuesta visible al cliente solo si todavía no había una (idempotente,
  // no se pisa si ya se registró una respuesta anterior).
  async recordFirstResponse(id: string): Promise<void> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket || ticket.primeraRespuestaEn) return;

    await ticketRepository.update(id, { primeraRespuestaEn: new Date() });
    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(ticket.empresaId));
  }

  // Borrado — acción crítica: exige motivo y queda auditado con detalle (ver
  // shared/security/critical-action.service.ts), igual criterio que aprobar/
  // rechazar una cotización o borrar un dispositivo.
  async deleteTicket(id: string, motivo: string): Promise<void> {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError('Ticket');
    assertOwnCompanyOrAdmin(ticket.empresaId);

    await ticketRepository.delete(id);
    await cacheService.invalidatePattern(CachePatterns.ticketsForCompany(ticket.empresaId));
    await recordCriticalAction({ accion: 'TICKET_DELETE', tabla: 'Ticket', registroId: id, motivo });
  }
}

export const ticketService = new TicketService();
