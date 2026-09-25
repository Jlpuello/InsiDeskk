import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import type { InventoryEquipmentFilters } from '../types/inventory.types.js';

// El "search" filtra solo sobre campos en claro (nombre/marca/modelo/
// ubicación) — numeroSerie/ipAddress/macAddress están cifrados en reposo
// (no determinístico), así que un `contains` de Postgres no podría matchear
// contra ellos aunque quisiéramos.
function buildWhere(filters: InventoryEquipmentFilters): Prisma.InventoryEquipmentWhereInput {
  const { empresaId, tipo, estado, search } = filters;
  return {
    ...(empresaId && { empresaId }),
    ...(tipo && { tipo }),
    ...(estado && { estado }),
    ...(search && {
      OR: [
        { nombre: { contains: search, mode: 'insensitive' } },
        { marca: { contains: search, mode: 'insensitive' } },
        { modelo: { contains: search, mode: 'insensitive' } },
        { ubicacion: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };
}

export class InventoryRepository {
  private get prisma() {
    return getPrismaClient();
  }

  // Sin anotar el tipo de retorno a mano: Prisma infiere la forma completa
  // (con `empresa` incluido) sola — anotarlo como Promise<InventoryEquipment>
  // la trunca silenciosamente y `empresa` queda inaccesible para quien llame
  // a este método (bug ya visto antes en otros repositorios de este proyecto).
  async create(data: Prisma.InventoryEquipmentCreateInput) {
    return this.prisma.inventoryEquipment.create({ data, include: { empresa: true } });
  }

  async findById(id: string) {
    return this.prisma.inventoryEquipment.findUnique({ where: { id }, include: { empresa: true } });
  }

  async findMany(filters: InventoryEquipmentFilters, skip?: number, take?: number) {
    return this.prisma.inventoryEquipment.findMany({
      where: buildWhere(filters),
      skip,
      take,
      orderBy: { nombre: 'asc' },
      include: { empresa: true },
    });
  }

  async update(id: string, data: Prisma.InventoryEquipmentUpdateInput) {
    return this.prisma.inventoryEquipment.update({ where: { id }, data, include: { empresa: true } });
  }

  async delete(id: string) {
    return this.prisma.inventoryEquipment.delete({ where: { id } });
  }

  async countByTipo(empresaId?: string): Promise<Record<string, number>> {
    const groups = await this.prisma.inventoryEquipment.groupBy({
      by: ['tipo'],
      where: empresaId ? { empresaId } : undefined,
      _count: { tipo: true },
    });
    return Object.fromEntries(groups.map((g) => [g.tipo, g._count.tipo]));
  }
}

export const inventoryRepository = new InventoryRepository();
