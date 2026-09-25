import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

export class ActaRepository {
  private get prisma() {
    return getPrismaClient();
  }

  // Sin anotación de retorno explícita a propósito: así TS infiere el tipo
  // real (con `creadoPor` incluido) en vez de acotarlo al modelo base
  // ActaEntrega, que perdería esa relación para quien llame a esto.
  async create(data: Prisma.ActaEntregaCreateInput) {
    return this.prisma.actaEntrega.create({ data, include: { creadoPor: { select: safeUserSelect } } });
  }

  async findByActivityId(actividadId: string) {
    return this.prisma.actaEntrega.findUnique({
      where: { actividadId },
      include: { creadoPor: { select: safeUserSelect } },
    });
  }

  async findById(id: string) {
    return this.prisma.actaEntrega.findUnique({
      where: { id },
      include: { actividad: true, creadoPor: { select: safeUserSelect } },
    });
  }

  async update(id: string, data: Prisma.ActaEntregaUpdateInput) {
    return this.prisma.actaEntrega.update({ where: { id }, data, include: { actividad: true } });
  }
}

export const actaRepository = new ActaRepository();
