import type { TicketLevelVisibility } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class TicketLevelVisibilityRepository {
  private get prisma() {
    return getPrismaClient();
  }

  // Solo trae las combinaciones que un admin explícitamente guardó — las
  // ausentes se interpretan como "visible" en el service, no acá.
  async findMany(): Promise<TicketLevelVisibility[]> {
    return this.prisma.ticketLevelVisibility.findMany({
      orderBy: [{ nivelTecnico: 'asc' }, { nivelTicket: 'asc' }],
    });
  }

  async upsert(nivelTecnico: number, nivelTicket: number, visible: boolean): Promise<TicketLevelVisibility> {
    return this.prisma.ticketLevelVisibility.upsert({
      where: { nivelTecnico_nivelTicket: { nivelTecnico, nivelTicket } },
      create: { nivelTecnico, nivelTicket, visible },
      update: { visible },
    });
  }
}

export const ticketLevelVisibilityRepository = new TicketLevelVisibilityRepository();
