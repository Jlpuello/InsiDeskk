export type TeamChannelType = 'dm' | 'grupo';

export interface TeamChannelSummary {
  id: string;
  tipo: TeamChannelType;
  // Nombre efectivo — para un DM ya viene resuelto al nombre del OTRO
  // participante (distinto según quién lo pida), no hace falta calcularlo acá.
  nombre: string;
  miembros: { id: string; nombre: string }[];
  ultimoMensaje: { contenido: string; createdAt: string; autorId: string } | null;
  noLeido: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMessage {
  id: string;
  channelId: string;
  userId: string;
  user: { id: string; nombre: string };
  contenido: string;
  createdAt: string;
}

// Payload que llega por el socket (namespace /team, evento "message").
export interface TeamMessageEvent {
  messageId: string;
  channelId: string;
  memberUserIds: string[];
  autorId: string;
  autorNombre: string;
  contenido: string;
  createdAt: string;
}
