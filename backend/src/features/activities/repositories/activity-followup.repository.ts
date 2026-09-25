import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

export class ActivityFollowupRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: { actividadId: string; usuarioId: string; contenido: string }) {
    return this.prisma.actividadSeguimiento.create({
      data,
      include: { usuario: { select: safeUserSelect } },
    });
  }

  async findByActivityId(actividadId: string) {
    return this.prisma.actividadSeguimiento.findMany({
      where: { actividadId },
      orderBy: { createdAt: 'asc' },
      include: { usuario: { select: safeUserSelect } },
    });
  }
}

export const activityFollowupRepository = new ActivityFollowupRepository();
