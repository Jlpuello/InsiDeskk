import { Prisma, type RemotelySession } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';

export class RemotelySessionRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.RemotelySessionCreateInput): Promise<RemotelySession> {
    return this.prisma.remotelySession.create({
      data,
      include: {
        dispositivo: true,
        usuario: { select: safeUserSelect },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.remotelySession.findUnique({
      where: { id },
      include: {
        dispositivo: true,
        usuario: { select: safeUserSelect },
      },
    });
  }

  async findByDeviceId(dispositivoId: string) {
    return this.prisma.remotelySession.findMany({
      where: { dispositivoId },
      orderBy: { fechaInicio: 'desc' },
      include: {
        dispositivo: true,
        usuario: { select: safeUserSelect },
      },
    });
  }

  async findActive() {
    return this.prisma.remotelySession.findMany({
      where: { fechaFin: null },
      include: {
        dispositivo: true,
        usuario: { select: safeUserSelect },
      },
    });
  }

  async update(id: string, data: Prisma.RemotelySessionUpdateInput) {
    return this.prisma.remotelySession.update({
      where: { id },
      data,
    });
  }

  async endSession(id: string) {
    const session = await this.prisma.remotelySession.findUnique({ where: { id } });
    if (!session) throw new NotFoundError('Sesión remota');

    const fechaFin = new Date();
    const duracionMinutos = Math.floor((fechaFin.getTime() - session.fechaInicio.getTime()) / 60000);

    return this.prisma.remotelySession.update({
      where: { id },
      data: { fechaFin, duracionMinutos },
    });
  }
}

export const remotelySessionRepository = new RemotelySessionRepository();
