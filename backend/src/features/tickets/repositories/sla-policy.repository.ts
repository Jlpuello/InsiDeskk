import type { Prisma, SlaPolicy, TicketCriticidad, TicketPriority } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class SlaPolicyRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async findMany(): Promise<SlaPolicy[]> {
    return this.prisma.slaPolicy.findMany({ orderBy: [{ prioridad: 'asc' }, { criticidad: 'asc' }] });
  }

  async find(prioridad: TicketPriority, criticidad: TicketCriticidad): Promise<SlaPolicy | null> {
    return this.prisma.slaPolicy.findUnique({ where: { prioridad_criticidad: { prioridad, criticidad } } });
  }

  async createMany(data: Prisma.SlaPolicyCreateManyInput[]): Promise<void> {
    if (data.length === 0) return;
    await this.prisma.slaPolicy.createMany({ data, skipDuplicates: true });
  }

  async upsert(
    prioridad: TicketPriority,
    criticidad: TicketCriticidad,
    data: { tiempoRespuestaMin: number; tiempoResolucionMin: number },
  ): Promise<SlaPolicy> {
    return this.prisma.slaPolicy.upsert({
      where: { prioridad_criticidad: { prioridad, criticidad } },
      create: { prioridad, criticidad, ...data },
      update: data,
    });
  }
}

export const slaPolicyRepository = new SlaPolicyRepository();
