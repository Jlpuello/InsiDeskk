import type { Conversation, ConversationChannel, ConversationMessage, ConversationStatus, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

const includeForList = {
  empresa: { select: { id: true, nombre: true } },
  usuarioAsignado: { select: safeUserSelect },
} satisfies Prisma.ConversationInclude;

export class ConversationRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return this.prisma.conversation.create({ data, include: includeForList });
  }

  async findById(id: string) {
    return this.prisma.conversation.findUnique({ where: { id }, include: includeForList });
  }

  async findByTokenHash(tokenHash: string) {
    return this.prisma.conversation.findUnique({ where: { tokenHash }, include: includeForList });
  }

  // Usado por conversationService.receiveWhatsappMessage para reusar el
  // hilo de un número que ya está conversando — si la última quedó
  // "cerrada", esto no la encuentra y se crea una nueva (mismo criterio que
  // reabrir un ticket cerrado: no se reabre solo, es un hilo nuevo).
  async findOpenByChannelAndPhone(canal: ConversationChannel, telefono: string): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: { canal, contactoTelefono: telefono, estado: 'abierta' },
      include: includeForList,
      orderBy: { ultimoMensajeEn: 'desc' },
    });
  }

  // Bandeja de staff — cualquier admin/tecnico ve todas las conversaciones,
  // mismo criterio de acceso abierto que ya rige Tickets entre técnicos.
  async findMany(where?: Prisma.ConversationWhereInput) {
    return this.prisma.conversation.findMany({
      where,
      include: includeForList,
      orderBy: { ultimoMensajeEn: 'desc' },
    });
  }

  async updateEstado(id: string, estado: ConversationStatus): Promise<Conversation> {
    return this.prisma.conversation.update({ where: { id }, data: { estado }, include: includeForList });
  }

  async updateAsignado(id: string, usuarioAsignadoId: string | null): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data: { usuarioAsignadoId },
      include: includeForList,
    });
  }

  // Se toca en cada mensaje nuevo (de cualquiera de los dos lados) — decide
  // el orden de la bandeja y, si el mensaje es del contacto, prende
  // tieneNoLeidos; si es de staff, lo apaga (responder ya cuenta como "leído").
  async touchOnMessage(id: string, tieneNoLeidos: boolean): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id },
      data: { ultimoMensajeEn: new Date(), tieneNoLeidos },
      include: includeForList,
    });
  }

  async markRead(id: string): Promise<void> {
    await this.prisma.conversation.update({ where: { id }, data: { tieneNoLeidos: false } });
  }

  async countUnread(): Promise<number> {
    return this.prisma.conversation.count({ where: { tieneNoLeidos: true } });
  }

  async createMessage(data: Prisma.ConversationMessageCreateInput): Promise<ConversationMessage> {
    return this.prisma.conversationMessage.create({
      data,
      include: { remitenteUser: { select: safeUserSelect } },
    });
  }

  async findMessages(conversationId: string) {
    return this.prisma.conversationMessage.findMany({
      where: { conversationId },
      include: { remitenteUser: { select: safeUserSelect } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const conversationRepository = new ConversationRepository();
