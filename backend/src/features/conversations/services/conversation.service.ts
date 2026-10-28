import type { Conversation, ConversationMessage, ConversationStatus } from '@prisma/client';
import { conversationRepository } from '../repositories/conversation.repository.js';
import { conversationTokenService } from './conversation-token.service.js';
import { companyService } from '../../companies/services/company.service.js';
import { userRepository } from '../../users/repositories/user.repository.js';
import { whatsappClientService } from '../../whatsapp/services/whatsapp-client.service.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { logger } from '../../../shared/utils/logger.js';
import { env } from '../../../config/env.js';
import { isKnownCompanyContact } from '../../../shared/security/contact-verification.js';

export interface StartConversationInput {
  nit: string;
  // Solo se usa si el NIT no matcheó ninguna Company existente (ver
  // companyService.resolveOrProvisionByNit) — para una empresa ya conocida
  // se ignora.
  nombreEmpresa?: string;
  contactoNombre: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  mensaje: string;
}

async function emitMessageCreated(
  conversation: Conversation,
  message: ConversationMessage,
  autorNombre: string,
): Promise<void> {
  await eventEmitter.emit('conversation.message.created', {
    messageId: message.id,
    conversationId: conversation.id,
    empresaId: conversation.empresaId,
    remitenteTipo: message.remitenteTipo,
    contenido: message.contenido,
    autorNombre,
    createdAt: message.createdAt.toISOString(),
  });
}

export class ConversationService {
  // ── Lado público (sin login, ver conversation.public.routes.ts) ─────────

  // Verifica la empresa por NIT (mismo método que ya usa el formulario
  // público de tickets), crea la conversación + primer mensaje, y devuelve
  // el token en claro UNA sola vez — el llamador lo guarda en localStorage,
  // acá nunca más se puede recuperar (mismo criterio que una contraseña).
  async startPublic(input: StartConversationInput): Promise<{ conversation: Conversation; token: string }> {
    const company = await companyService.resolveOrProvisionByNit(input.nit, input.nombreEmpresa);
    const contactoVerificado = await isKnownCompanyContact(company.id, input.contactoEmail, input.contactoTelefono);

    const { token, tokenHash } = conversationTokenService.generate();

    const conversation = await conversationRepository.create({
      empresa: { connect: { id: company.id } },
      contactoNombre: input.contactoNombre,
      contactoEmail: input.contactoEmail,
      contactoTelefono: input.contactoTelefono,
      contactoVerificado,
      tokenHash,
    });

    const message = await conversationRepository.createMessage({
      conversation: { connect: { id: conversation.id } },
      remitenteTipo: 'contacto',
      contenido: input.mensaje,
    });

    await emitMessageCreated(conversation, message, input.contactoNombre);

    return { conversation, token };
  }

  async resolveByToken(token: string): Promise<Conversation> {
    const conversation = await conversationRepository.findByTokenHash(conversationTokenService.hash(token));
    if (!conversation) throw new NotFoundError('Conversación');
    return conversation;
  }

  async getMessagesPublic(token: string): Promise<ConversationMessage[]> {
    const conversation = await this.resolveByToken(token);
    return conversationRepository.findMessages(conversation.id);
  }

  async postMessagePublic(token: string, contenido: string): Promise<ConversationMessage> {
    const conversation = await this.resolveByToken(token);
    if (conversation.estado === 'cerrada') {
      throw new AppError('Esta conversación ya fue cerrada', 422);
    }

    const message = await conversationRepository.createMessage({
      conversation: { connect: { id: conversation.id } },
      remitenteTipo: 'contacto',
      contenido,
    });

    await conversationRepository.touchOnMessage(conversation.id, true);
    await emitMessageCreated(conversation, message, conversation.contactoNombre);

    return message;
  }

  // ── WhatsApp (webhook de Meta, ver features/whatsapp) ────────────────────

  // Reusa el hilo abierto de ese número si existe; si no (primer contacto, o
  // la última quedó cerrada), resuelve/autoprovisiona la empresa por
  // teléfono (mismo criterio que el NIT, ver companyService.resolveOrProvisionByPhone)
  // y arranca una conversación nueva. El tokenHash se genera igual que en el
  // flujo web pero nunca se usa (WhatsApp no tiene "volver con un link") —
  // más simple que volver nullable una columna @unique no-nula por esto.
  async receiveWhatsappMessage(phone: string, nombreContacto: string, texto: string): Promise<ConversationMessage> {
    let conversation = await conversationRepository.findOpenByChannelAndPhone('whatsapp', phone);

    if (!conversation) {
      const company = await companyService.resolveOrProvisionByPhone(phone, nombreContacto);
      const { tokenHash } = conversationTokenService.generate();
      conversation = await conversationRepository.create({
        empresa: { connect: { id: company.id } },
        canal: 'whatsapp',
        contactoNombre: nombreContacto || phone,
        contactoTelefono: phone,
        tokenHash,
      });
    }

    const message = await conversationRepository.createMessage({
      conversation: { connect: { id: conversation.id } },
      remitenteTipo: 'contacto',
      contenido: texto,
    });

    await conversationRepository.touchOnMessage(conversation.id, true);
    await emitMessageCreated(conversation, message, nombreContacto || phone);

    return message;
  }

  // ── Lado staff (autenticado, ver conversation.routes.ts) ─────────────────

  async list(estado?: ConversationStatus): Promise<Conversation[]> {
    return conversationRepository.findMany(estado ? { estado } : undefined);
  }

  async getById(id: string): Promise<Conversation> {
    const conversation = await conversationRepository.findById(id);
    if (!conversation) throw new NotFoundError('Conversación');
    return conversation;
  }

  // Abrir la conversación YA la marca leída para todo el equipo — ver
  // Conversation.tieneNoLeidos (acceso abierto entre técnicos, no hay
  // "leído por mí" individual en v1).
  async getMessages(id: string): Promise<ConversationMessage[]> {
    await this.getById(id);
    await conversationRepository.markRead(id);
    return conversationRepository.findMessages(id);
  }

  async postMessageStaff(id: string, userId: string, contenido: string): Promise<ConversationMessage> {
    const conversation = await this.getById(id);
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('Usuario');

    const message = await conversationRepository.createMessage({
      conversation: { connect: { id } },
      remitenteTipo: 'staff',
      remitenteUser: { connect: { id: userId } },
      contenido,
    });

    await conversationRepository.touchOnMessage(id, false);
    await emitMessageCreated(conversation, message, user.nombre);

    // El mensaje ya quedó guardado en InsiDesk pase lo que pase acá abajo —
    // si el reenvío por WhatsApp falla (credenciales, ventana de 24h
    // cerrada, etc.) se loggea nada más, no se revierte ni se le muestra un
    // error al staff (ver whatsapp-client.service.ts).
    if (conversation.canal === 'whatsapp' && conversation.contactoTelefono) {
      try {
        await whatsappClientService.sendTextMessage(conversation.contactoTelefono, contenido);
      } catch (err) {
        logger.warn(`No se pudo reenviar por WhatsApp a ${conversation.contactoTelefono}: ${(err as Error).message}`);
      }
    }

    return message;
  }

  // Le manda al contacto externo un link para que se baje el ejecutable
  // PORTÁTIL de Remotely (no instala nada, solo muestra un código de sesión en
  // pantalla) — reemplaza al viejo link de instalador permanente, que se quitó
  // por seguridad: instalar un agente persistente debe quedar SIEMPRE en manos
  // de un técnico/admin (ver AgentsPage, ruta autenticada admin-only), nunca
  // como una acción que un contacto externo dispara solo con abrir un link de
  // chat. El link apunta a nuestro dominio (no al servidor de Remotely
  // directo, ver remotely-public.controller.ts#portableDownload) — se manda
  // con postMessageStaff de arriba para heredar gratis el guardado, el socket
  // y el reenvío por WhatsApp si corresponde.
  async sendPortableConnectLink(conversationId: string, staffUserId: string): Promise<ConversationMessage> {
    await this.getById(conversationId);
    if (!env.apiPublicUrl) {
      throw new AppError('Falta configurar API_PUBLIC_URL para poder generar el link', 422);
    }

    const url = `${env.apiPublicUrl.replace(/\/+$/, '')}/api/public/remotely/portable-download`;
    const mensaje = `Para brindarte soporte remoto, abrí este link y ejecutá la aplicación (no instala nada): ${url}\n\nVa a mostrarte un código en pantalla — pasáselo al técnico para conectarse.`;

    return this.postMessageStaff(conversationId, staffUserId, mensaje);
  }

  async assign(id: string, usuarioAsignadoId: string | null): Promise<Conversation> {
    await this.getById(id);
    return conversationRepository.updateAsignado(id, usuarioAsignadoId);
  }

  async setEstado(id: string, estado: ConversationStatus): Promise<Conversation> {
    await this.getById(id);
    return conversationRepository.updateEstado(id, estado);
  }

  async unreadCount(): Promise<number> {
    return conversationRepository.countUnread();
  }
}

export const conversationService = new ConversationService();
