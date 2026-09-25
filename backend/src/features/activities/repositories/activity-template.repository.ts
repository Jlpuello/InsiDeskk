import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

const include = {
  empresa: true,
  usuarioAsignado: { select: safeUserSelect },
  dispositivo: { select: { id: true, nombre: true } },
} satisfies Prisma.ActividadPlantillaInclude;

export class ActivityTemplateRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.ActividadPlantillaCreateInput) {
    return this.prisma.actividadPlantilla.create({ data, include });
  }

  async findById(id: string) {
    return this.prisma.actividadPlantilla.findUnique({ where: { id }, include });
  }

  async findMany(where?: Prisma.ActividadPlantillaWhereInput) {
    return this.prisma.actividadPlantilla.findMany({ where, orderBy: { titulo: 'asc' }, include });
  }

  async findAllActive() {
    return this.prisma.actividadPlantilla.findMany({ where: { activo: true } });
  }

  async update(id: string, data: Prisma.ActividadPlantillaUpdateInput) {
    return this.prisma.actividadPlantilla.update({ where: { id }, data, include });
  }
}

export const activityTemplateRepository = new ActivityTemplateRepository();
