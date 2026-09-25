import type { Prisma, TeamChannelMember, TeamMessage } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

// Trae el ÚLTIMO mensaje de cada canal en la misma query (Prisma soporta
// `take` en una relación anidada) — evita un N+1 al armar la lista.
const includeForList = {
  miembros: { include: { user: { select: safeUserSelect } } },
  mensajes: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.TeamChannelInclude;

// Shape exacto que devuelven findDmChannel/create/findById/listForUser —
// exportado para que el service pueda tipar sin castear a mano.
export type TeamChannelWithIncludes = Prisma.TeamChannelGetPayload<{ include: typeof includeForList }>;

export class TeamChannelRepository {
  private get prisma() {
    return getPrismaClient();
  }

  // Para no duplicar un DM entre las mismas dos personas — un segundo
  // intento de "hablar con Fulano" reusa el canal existente.
  async findDmChannel(userIdA: string, userIdB: string): Promise<TeamChannelWithIncludes | null> {
    return this.prisma.teamChannel.findFirst({
      where: {
        tipo: 'dm',
        AND: [{ miembros: { some: { userId: userIdA } } }, { miembros: { some: { userId: userIdB } } }],
      },
      include: includeForList,
    });
  }

  async create(data: Prisma.TeamChannelCreateInput): Promise<TeamChannelWithIncludes> {
    return this.prisma.teamChannel.create({ data, include: includeForList });
  }

  async findById(id: string): Promise<TeamChannelWithIncludes | null> {
    return this.prisma.teamChannel.findUnique({ where: { id }, include: includeForList });
  }

  async listForUser(userId: string): Promise<TeamChannelWithIncludes[]> {
    return this.prisma.teamChannel.findMany({
      where: { miembros: { some: { userId } } },
      include: includeForList,
    });
  }

  async getMembership(channelId: string, userId: string): Promise<TeamChannelMember | null> {
    return this.prisma.teamChannelMember.findUnique({ where: { channelId_userId: { channelId, userId } } });
  }

  async addMember(channelId: string, userId: string): Promise<TeamChannelMember> {
    return this.prisma.teamChannelMember.create({ data: { channelId, userId } });
  }

  async removeMember(channelId: string, userId: string): Promise<void> {
    await this.prisma.teamChannelMember.deleteMany({ where: { channelId, userId } });
  }

  async touchLectura(channelId: string, userId: string): Promise<void> {
    await this.prisma.teamChannelMember.updateMany({
      where: { channelId, userId },
      data: { ultimaLecturaEn: new Date() },
    });
  }

  async createMessage(data: Prisma.TeamMessageCreateInput): Promise<TeamMessage> {
    return this.prisma.teamMessage.create({ data, include: { user: { select: safeUserSelect } } });
  }

  async findMessages(channelId: string) {
    return this.prisma.teamMessage.findMany({
      where: { channelId },
      include: { user: { select: safeUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const teamChannelRepository = new TeamChannelRepository();
