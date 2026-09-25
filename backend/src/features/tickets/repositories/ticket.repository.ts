import { Prisma, type Ticket, type TicketStatus } from '@prisma/client';
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
