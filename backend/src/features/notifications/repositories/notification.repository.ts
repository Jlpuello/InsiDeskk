import { getPrismaClient } from '../../../shared/prisma/client.js';

export class NotificationRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async findForUser(usuarioId: string, skip: number, take: number) {
    const where = { usuarioId };
    const [rows, total] = await Promise.all([
      this.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.notification.count({ where }),
    ]);
    return { rows, total };
  }

  async countUnread(usuarioId: string): Promise<number> {
    return this.prisma.notification.count({ where: { usuarioId, leida: false } });
  }

  // updateMany en vez de update: si el id no existe o no es de este usuario,
  // count queda en 0 en lugar de tirar P2025 (record not found) — evita que
  // alguien confirme por el count devuelto si un id "pertenece" a otro
  // usuario, sin necesidad de un findUnique previo.
  async markRead(id: string, usuarioId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { id, usuarioId },
      data: { leida: true },
    });
    return result.count;
  }

  async markAllRead(usuarioId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { usuarioId, leida: false },
      data: { leida: true },
    });
    return result.count;
  }
}

export const notificationRepository = new NotificationRepository();
