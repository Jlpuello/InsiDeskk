// Demo autocontenida con datos mock (ver mockData.ts) — pensada para
// reemplazar los mocks por llamadas reales a la API una vez aprobado el
// diseño. No comparte tipos con features/conversations ni features/team-chat
// a propósito, para no acoplar esta iteración visual a esa integración
// todavía.

export const CURRENT_USER_ID = 'me';

export interface User {
  id: string;
  name: string;
  // Clase de Tailwind para el fondo del avatar (ej. "bg-green-500").
  avatarColor: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  // ISO 8601.
  timestamp: string;
}

export interface Conversation {
  id: string;
  name: string;
  isGroup: boolean;
  // 1 letra para 1:1, 2 para grupo (ej. "WH" de "Weekend Hiking").
  avatarInitials: string;
  avatarColor: string;
  // No incluye a CURRENT_USER_ID.
  participantIds: string[];
  unreadCount: number;
}
