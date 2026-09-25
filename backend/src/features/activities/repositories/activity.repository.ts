import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

const include = {
  empresa: true,
  usuarioAsignado: { select: safeUserSelect },
  ticket: { select: { id: true, titulo: true } },
  dispositivo: { select: { id: true, nombre: true } },
  plantilla: { select: { id: true, titulo: true } },
} satisfies Prisma.ActividadInclude;

export class ActivityRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.ActividadCreateInput) {
    return this.prisma.actividad.create({ data, include });
  }

  async findById(id: string) {
    return this.prisma.actividad.findUnique({
      where: { id },
      include: {
        ...include,
        seguimientos: { include: { usuario: { select: safeUserSelect } }, orderBy: { createdAt: 'asc' } },
        acta: true,
      },
    });
  }

  async findMany(where?: Prisma.ActividadWhereInput, skip?: number, take?: number) {
    return this.prisma.actividad.findMany({
      where,
      skip,
      take,
      orderBy: { fechaPlaneada: 'asc' },
      include,
    });
  }

  async update(id: string, data: Prisma.ActividadUpdateInput) {
    return this.prisma.actividad.update({ where: { id }, data, include });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.actividad.delete({ where: { id } });
  }

  // Para el scheduler de recurrencia: ¿ya existe una actividad de esta
  // plantilla generada después de `since`? Evita duplicar la del período
  // actual si el cron corre más de una vez o el server se reinicia.
  async existsForTemplateSince(plantillaId: string, since: Date): Promise<boolean> {
    const count = await this.prisma.actividad.count({
      where: { plantillaId, createdAt: { gte: since } },
    });
    return count > 0;
  }
}

export const activityRepository = new ActivityRepository();
