import type { ReactNode } from 'react';

// Prefijos que distinguen las dos fuentes (Conversation externa / TeamChannel)
// dentro de un mismo id de ChatConversation — compartidos entre MessagesPage
// (la bandeja completa) y MessagesIndicator (la vista previa en el TopBar)
// para que un id armado en uno se pueda resolver en el otro.
export const EXT_PREFIX = 'ext:';
export const TEAM_PREFIX = 'team:';

// Modelo genérico, agnóstico del dominio — inspirado en la forma de
// @mui/x-chat (adapter + conversations/messages desacoplados de la UI), pero
// sin esa dependencia (está en alpha y trae Material UI entero, dos cosas
// que no queríamos meter acá). ChatBox.tsx es el único lugar que sabe
// dibujar una lista de conversaciones + un hilo — cada feature (Conversation
// externa, DM/canal de equipo) solo mapea sus propios datos a esta forma.
export interface ChatConversation {
  id: string;
  title: string;
  subtitle?: string;
  // Iniciales/ícono a mostrar en el avatar de la lista — si no viene ninguno
  // de los dos, se usa la primera letra de `title`.
  avatarLabel?: string;
  avatarIcon?: ReactNode;
  // Borde izquierdo de la fila en la lista (hex/rgb) — distingue el TIPO de
  // conversación de un vistazo (WhatsApp vs chat web vs canal de equipo),
  // sin tener que leer el ícono. undefined = sin acento (ej. un DM 1:1 de
  // equipo, que ya no tiene nada más con quien confundirse en la lista).
  accentColor?: string;
  unread?: boolean;
  // Para ordenar la lista (más reciente primero) — string ISO.
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  // 'own' = lo mandó quien está mirando la pantalla (se alinea a la
  // derecha) — cada feature decide qué significa eso para su propio caso
  // (staff vs contacto externo; yo vs el resto del canal).
  role: 'own' | 'other';
  author: { id: string; displayName: string };
  text: string;
  createdAt: string;
}

// Lo único que ChatBox necesita para poder mandar un mensaje — no sabe nada
// de REST/sockets/tokens, cada feature arma el suyo.
export interface ChatAdapter {
  sendMessage: (conversationId: string, text: string) => Promise<ChatMessage>;
}
