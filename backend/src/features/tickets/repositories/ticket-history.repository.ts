import type { TicketHistory } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class TicketHistoryRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: {
    ticketId: string;
    campoModificado: string;
    valorAnterior?: string | null;
    valorNuevo?: string | null;
    usuarioId: string;
    razon?: string | null;
  }): Promise<TicketHistory> {
    return this.prisma.ticketHistory.create({ data });
  }

  async findByTicketId(ticketId: string) {
    return this.prisma.ticketHistory.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const ticketHistoryRepository = new TicketHistoryRepository();
