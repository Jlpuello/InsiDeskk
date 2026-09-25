import type { TeamChannelType, TeamMessage } from '@prisma/client';
import { teamChannelRepository, type TeamChannelWithIncludes } from '../repositories/team-channel.repository.js';
import { userRepository } from '../../users/repositories/user.repository.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../shared/utils/error.handler.js';

export interface TeamChannelSummary {
  id: string;
  tipo: TeamChannelType;
  // Nombre EFECTIVO, calculado según quién pregunta — un DM no tiene nombre
  // propio, se muestra el del otro participante (distinto para cada lado).
  nombre: string;
  miembros: { id: string; nombre: string }[];
  ultimoMensaje: { contenido: string; createdAt: Date; autorId: string } | null;
  noLeido: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(channel: TeamChannelWithIncludes, currentUserId: string): TeamChannelSummary {
  const miembros = channel.miembros.map((m) => ({ id: m.user.id, nombre: m.user.nombre }));
  const nombre =
    channel.tipo === 'grupo'
      ? (channel.nombre ?? 'Canal')
      : (miembros.find((m) => m.id !== currentUserId)?.nombre ?? 'Vos');

  const ultimo = channel.mensajes[0] ?? null;
  const miMembresia = channel.miembros.find((m) => m.userId === currentUserId);
  // No leído: hay un mensaje más nuevo que la última lectura de ESTE
  // usuario, y no es de él mismo (no te marcás algo "no leído" a vos mismo).
  const noLeido = Boolean(
    ultimo && ultimo.userId !== currentUserId && (!miMembresia?.ultimaLecturaEn || ultimo.createdAt > miMembresia.ultimaLecturaEn),
  );

  return {
    id: channel.id,
    tipo: channel.tipo,
    nombre,
    miembros,
    ultimoMensaje: ultimo ? { contenido: ultimo.contenido, createdAt: ultimo.createdAt, autorId: ultimo.userId } : null,
    noLeido,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

export class TeamChannelService {
  async getOrCreateDm(currentUserId: string, otherUserId: string): Promise<TeamChannelSummary> {
    if (currentUserId === otherUserId) throw new AppError('No podés iniciar un DM con vos mismo', 422);

    const existing = await teamChannelRepository.findDmChannel(currentUserId, otherUserId);
    if (existing) return toSummary(existing, currentUserId);

    const created = await teamChannelRepository.create({
      tipo: 'dm',
      createdBy: { connect: { id: currentUserId } },
      miembros: { create: [{ userId: currentUserId }, { userId: otherUserId }] },
    });
    return toSummary(created, currentUserId);
  }

  async createGroup(currentUserId: string, nombre: string, miembroIds: string[]): Promise<TeamChannelSummary> {
    const allIds = Array.from(new Set([currentUserId, ...miembroIds]));
    const created = await teamChannelRepository.create({
      tipo: 'grupo',
      nombre,
      createdBy: { connect: { id: currentUserId } },
      miembros: { create: allIds.map((userId) => ({ userId })) },
    });
    return toSummary(created, currentUserId);
  }

  async listMine(userId: string): Promise<TeamChannelSummary[]> {
    const channels = await teamChannelRepository.listForUser(userId);
    return channels.map((c) => toSummary(c, userId)).sort((a, b) => {
      const aTime = (a.ultimoMensaje?.createdAt ?? a.createdAt).getTime();
      const bTime = (b.ultimoMensaje?.createdAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
  }

  // Sin booleano denormalizado (a diferencia de Conversation.tieneNoLeidos):
  // el no-leído acá es por usuario, así que se calcula sobre listMine().
  // Volumen bajo (equipo interno chico) — no vale la pena optimizarlo.
  async unreadCount(userId: string): Promise<number> {
    const channels = await this.listMine(userId);
    return channels.filter((c) => c.noLeido).length;
  }

  private async assertMember(channelId: string, userId: string): Promise<TeamChannelWithIncludes> {
    const channel = await teamChannelRepository.findById(channelId);
    if (!channel) throw new NotFoundError('Canal');
    if (!channel.miembros.some((m) => m.userId === userId)) {
      throw new ForbiddenError('No sos miembro de este canal');
    }
    return channel;
  }

  async getMessages(channelId: string, userId: string) {
    await this.assertMember(channelId, userId);
    await teamChannelRepository.touchLectura(channelId, userId);
    return teamChannelRepository.findMessages(channelId);
  }

  async postMessage(channelId: string, userId: string, contenido: string): Promise<TeamMessage> {
    const channel = await this.assertMember(channelId, userId);
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Usuario');

    const message = await teamChannelRepository.createMessage({
      channel: { connect: { id: channelId } },
      user: { connect: { id: userId } },
      contenido,
    });

    await eventEmitter.emit('team.message.created', {
      messageId: message.id,
      channelId,
      memberUserIds: channel.miembros.map((m) => m.userId),
      autorId: userId,
      autorNombre: user.nombre,
      contenido,
      createdAt: message.createdAt.toISOString(),
    });

    return message;
  }

  // Cualquier miembro puede sumar gente al canal — mismo criterio de acceso
  // abierto que ya rige Tickets/Conversation entre técnicos.
  async addMember(channelId: string, requesterId: string, newUserId: string): Promise<void> {
    const channel = await this.assertMember(channelId, requesterId);
    if (channel.miembros.some((m) => m.userId === newUserId)) return;
    await teamChannelRepository.addMember(channelId, newUserId);
  }

  // Quitar a alguien SÍ es más restrictivo: solo quien creó el canal, o un
  // admin — evita que cualquiera saque a otro de un canal grupal.
  async removeMember(channelId: string, requesterId: string, requesterRol: string, targetUserId: string): Promise<void> {
    const channel = await this.assertMember(channelId, requesterId);
    if (channel.createdById !== requesterId && requesterRol !== 'admin') {
      throw new ForbiddenError('Solo quien creó el canal (o un admin) puede quitar miembros');
    }
    await teamChannelRepository.removeMember(channelId, targetUserId);
  }

  // Usado por el bridge de sockets al conectar — a qué salas unir a este
  // usuario (ver team-chat-realtime.service.ts).
  async listChannelIdsForUser(userId: string): Promise<string[]> {
    const channels = await teamChannelRepository.listForUser(userId);
    return channels.map((c) => c.id);
  }
}

export const teamChannelService = new TeamChannelService();
