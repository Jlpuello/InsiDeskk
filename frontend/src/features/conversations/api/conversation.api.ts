import { apiClient } from '../../../shared/api/client.ts';
import type { ConversationMessage, ConversationStatus, ConversationSummary } from '../types/conversation.types.ts';

// Lado staff (autenticado, admin/tecnico) — ver backend/conversation.routes.ts.
export const conversationApi = {
  async list(estado?: ConversationStatus): Promise<ConversationSummary[]> {
    const { data } = await apiClient.get<{ data: ConversationSummary[] }>('/conversations', { params: { estado } });
    return data.data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ data: { count: number } }>('/conversations/unread-count');
    return data.data.count;
  },

  async getMessages(id: string): Promise<{ conversation: ConversationSummary; messages: ConversationMessage[] }> {
    const { data } = await apiClient.get<{ data: { conversation: ConversationSummary; messages: ConversationMessage[] } }>(
      `/conversations/${id}/messages`,
    );
    return data.data;
  },

  async postMessage(id: string, contenido: string): Promise<ConversationMessage> {
    const { data } = await apiClient.post<{ data: ConversationMessage }>(`/conversations/${id}/messages`, {
      contenido,
    });
    return data.data;
  },

  // El mensaje resultante llega solo al hilo vía el socket de staff (mismo
  // mecanismo, deduplicado por id, que ya usa cualquier respuesta normal) —
  // no hace falta tocar el estado local después de llamar esto.
  async sendPortableConnectLink(id: string): Promise<ConversationMessage> {
    const { data } = await apiClient.post<{ data: ConversationMessage }>(`/conversations/${id}/portable-connect-link`);
    return data.data;
  },

  async assign(id: string, usuarioAsignadoId: string | null): Promise<ConversationSummary> {
    const { data } = await apiClient.put<{ data: ConversationSummary }>(`/conversations/${id}/assign`, {
      usuarioAsignadoId,
    });
    return data.data;
  },

  async setEstado(id: string, estado: ConversationStatus): Promise<ConversationSummary> {
    const { data } = await apiClient.put<{ data: ConversationSummary }>(`/conversations/${id}/estado`, { estado });
    return data.data;
  },
};
