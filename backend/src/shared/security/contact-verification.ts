import type { Prisma } from '@prisma/client';
import { getPrismaClient } from '../prisma/client.js';
import { userRepository } from '../../features/users/repositories/user.repository.js';

// "Contacto conocido" = ya existe una relación previa entre este email/
// teléfono y esta empresa: una cuenta de portal (User.empresaId), un ticket
// anterior reportado con este contacto, o una conversación anterior con él.
// NINGUNA de estas es una garantía fuerte de identidad — es una señal
// blanda para que el equipo revise el caso, nunca un bloqueo (mismo
// criterio que Company.verificado: nunca bloquea la creación, solo la
// marca). Ver Ticket.contactoVerificado / Conversation.contactoVerificado.
export async function isKnownCompanyContact(empresaId: string, email?: string, telefono?: string): Promise<boolean> {
  if (!email && !telefono) return false;

  if (email) {
    const user = await userRepository.findByEmail(email);
    if (user && user.empresaId === empresaId) return true;
  }

  const prisma = getPrismaClient();

  const ticketFilters: Prisma.TicketWhereInput[] = [];
  if (email) ticketFilters.push({ reporterEmail: email });
  if (telefono) ticketFilters.push({ reporterTelefono: telefono });
  if (ticketFilters.length > 0) {
    const priorTicket = await prisma.ticket.findFirst({
      where: { empresaId, OR: ticketFilters },
      select: { id: true },
    });
    if (priorTicket) return true;
  }

  const conversationFilters: Prisma.ConversationWhereInput[] = [];
  if (email) conversationFilters.push({ contactoEmail: email });
  if (telefono) conversationFilters.push({ contactoTelefono: telefono });
  if (conversationFilters.length > 0) {
    const priorConversation = await prisma.conversation.findFirst({
      where: { empresaId, OR: conversationFilters },
      select: { id: true },
    });
    if (priorConversation) return true;
  }

  return false;
}
