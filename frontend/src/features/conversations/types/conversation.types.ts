export type ConversationChannel = 'web' | 'whatsapp';
export type ConversationStatus = 'abierta' | 'cerrada';
export type MessageSender = 'contacto' | 'staff';

export interface ConversationSummary {
  id: string;
  empresaId: string;
  empresa: { id: string; nombre: string };
  canal: ConversationChannel;
  estado: ConversationStatus;
  contactoNombre: string;
  contactoEmail: string | null;
  contactoTelefono: string | null;
  // Ver Ticket.contactoVerificado (mismo criterio) — nunca bloquea, solo
  // marca para revisión cuando el contacto no coincide con ninguno ya
  // conocido de esta empresa.
  contactoVerificado: boolean;
  usuarioAsignadoId: string | null;
  usuarioAsignado: { id: string; nombre: string } | null;
  tieneNoLeidos: boolean;
  ultimoMensajeEn: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  remitenteTipo: MessageSender;
  remitenteUserId: string | null;
  remitenteUser: { id: string; nombre: string } | null;
  contenido: string;
  createdAt: string;
}

// Payload que llega por el socket (namespace /conversations, evento
// "message") — mismo shape que DomainEvents['conversation.message.created']
// en el backend.
export interface ConversationMessageEvent {
  messageId: string;
  conversationId: string;
  empresaId: string;
  remitenteTipo: MessageSender;
  contenido: string;
  autorNombre: string;
  createdAt: string;
}
