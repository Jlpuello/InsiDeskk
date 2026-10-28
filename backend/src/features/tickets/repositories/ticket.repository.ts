import { Prisma, type Ticket, type TicketPriority, type TicketStatus } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';
import { logger } from '../../../shared/utils/logger.js';

export class TicketRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.TicketCreateInput): Promise<Ticket> {
    try {
      return await this.prisma.ticket.create({
        data,
        include: {
          empresa: true,
          usuarioReporter: { select: safeUserSelect },
          categoria: true,
          subcategoria: true,
        },
      });
    } catch (error) {
      logger.error(`Error creando ticket: ${(error as Error).message}`);
      throw error;
    }
  }

  async findById(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      include: {
        empresa: true,
        usuarioReporter: { select: safeUserSelect },
        usuarioAsignado: { select: safeUserSelect },
        resuelto: { select: safeUserSelect },
        dispositivo: true,
        categoria: true,
        subcategoria: true,
        notas: {
          include: {
            usuario: { select: safeUserSelect },
          },
        },
        historial: {
          include: {
            usuario: { select: safeUserSelect },
          },
        },
        sesionesRemotely: true,
      },
    });
  }

  async findMany(where?: Prisma.TicketWhereInput, skip?: number, take?: number) {
    return this.prisma.ticket.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        empresa: true,
        usuarioReporter: { select: safeUserSelect },
        usuarioAsignado: { select: safeUserSelect },
        dispositivo: true,
        categoria: true,
        subcategoria: true,
      },
    });
  }

  async update(id: string, data: Prisma.TicketUpdateInput) {
    return this.prisma.ticket.update({
      where: { id },
      data,
      include: {
        empresa: true,
        usuarioAsignado: { select: safeUserSelect },
        resuelto: { select: safeUserSelect },
        categoria: true,
        subcategoria: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.ticket.delete({
      where: { id },
    });
  }

  async count(where?: Prisma.TicketWhereInput) {
    return this.prisma.ticket.count({ where });
  }

  // Carga actual de cada candidato (solo tickets no terminales) — usado por
  // TicketService.pickLeastLoadedTechnician para la auto-asignación por
  // nivel. Un candidato sin entrada en el resultado tiene carga 0.
  async countOpenByAssignees(assigneeIds: string[]): Promise<Record<string, number>> {
    if (assigneeIds.length === 0) return {};

    const groups = await this.prisma.ticket.groupBy({
      by: ['usuarioAsignadoId'],
      where: {
        usuarioAsignadoId: { in: assigneeIds },
        estado: { in: ['abierto', 'en_progreso', 'en_espera'] },
      },
      _count: { usuarioAsignadoId: true },
    });

    const result: Record<string, number> = {};
    for (const group of groups) {
      if (group.usuarioAsignadoId) result[group.usuarioAsignadoId] = group._count.usuarioAsignadoId;
    }
    return result;
  }

  async countByStatus(empresaId?: string): Promise<Record<TicketStatus, number>> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['estado'],
      where: empresaId ? { empresaId } : undefined,
      _count: { estado: true },
    });

    const base: Record<TicketStatus, number> = {
      abierto: 0,
      en_progreso: 0,
      en_espera: 0,
      esperando_aprobacion: 0,
      cerrado: 0,
      cancelado: 0,
    };

    for (const group of groups) {
      base[group.estado] = group._count.estado;
    }

    return base;
  }

  // Para el gráfico de barras "Tickets por prioridad" del Dashboard — mismo
  // criterio que countByStatus (groupBy + relleno de valores en 0).
  async countByPriority(empresaId?: string): Promise<Record<TicketPriority, number>> {
    const groups = await this.prisma.ticket.groupBy({
      by: ['prioridad'],
      where: empresaId ? { empresaId } : undefined,
      _count: { prioridad: true },
    });

    const base: Record<TicketPriority, number> = { baja: 0, media: 0, alta: 0, critica: 0 };
    for (const group of groups) {
      base[group.prioridad] = group._count.prioridad;
    }
    return base;
  }

  // Para el gráfico de tendencia del Dashboard — Prisma no soporta agrupar
  // por fecha truncada vía groupBy (solo por columnas reales), así que esto
  // es SQL crudo. "createdAt" va entre comillas porque la columna es
  // camelCase (confirmado contra la tabla real, \d tickets) — Postgres
  // pliega a minúsculas un identificador sin comillas, así que sin ellas
  // apuntaría a una columna "createdat" inexistente. Solo trae los días CON
  // al menos un ticket — el relleno de días en 0 se hace en el service.
  async countByDay(empresaId: string | undefined, days: number): Promise<{ date: string; count: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count
      FROM tickets
      WHERE "createdAt" >= NOW() - (INTERVAL '1 day' * ${days})
      ${empresaId ? Prisma.sql`AND empresa_id = ${empresaId}` : Prisma.empty}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), count: Number(r.count) }));
  }

  // Consultas específicas
  async findByCompanyId(empresaId: string, skip?: number, take?: number) {
    return this.prisma.ticket.findMany({
      where: { empresaId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByAssignee(usuarioId: string) {
    return this.prisma.ticket.findMany({
      where: { usuarioAsignadoId: usuarioId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByStatus(estado: TicketStatus, empresaId?: string) {
    return this.prisma.ticket.findMany({
      where: {
        estado,
        ...(empresaId && { empresaId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const ticketRepository = new TicketRepository();
