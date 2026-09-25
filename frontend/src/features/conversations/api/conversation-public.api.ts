import { apiClient } from '../../../shared/api/client.ts';
import type { ConversationMessage, ConversationSummary } from '../types/conversation.types.ts';

export interface StartConversationInput {
  nit: string;
  // Solo si verifyCompany dio encontrada:false — ver
  // companyService.resolveOrProvisionByNit en el backend.
  nombreEmpresa?: string;
  contactoNombre: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  mensaje: string;
}

// Sin autenticación (ver backend: /api/public/conversations, montado sin
// verifyJWT) — usado por el widget de chat de la landing page (/chat). El
// token que devuelve `start` es la única credencial; quien lo llama lo debe
// guardar (localStorage) para poder volver a la misma conversación.
export const conversationPublicApi = {
  // Ya no rechaza NITs desconocidos — `encontrada` le dice al widget si hace
  // falta pedir el nombre de la empresa antes de seguir.
  async verifyCompany(nit: string): Promise<{ encontrada: boolean; company: { id: string; nombre: string } | null }> {
    const { data } = await apiClient.get<{ data: { encontrada: boolean; company: { id: string; nombre: string } | null } }>(
      '/public/conversations/verify-company',
      { params: { nit } },
    );
    return data.data;
  },

  async start(input: StartConversationInput): Promise<{ conversationId: string; token: string }> {
    const { data } = await apiClient.post<{ data: { conversationId: string; token: string } }>(
      '/public/conversations',
      input,
    );
    return data.data;
  },

  async getByToken(token: string): Promise<{ conversation: ConversationSummary; messages: ConversationMessage[] }> {
    const { data } = await apiClient.get<{
      data: { conversation: ConversationSummary; messages: ConversationMessage[] };
    }>(`/public/conversations/${token}`);
    return data.data;
  },

  async postMessage(token: string, contenido: string): Promise<ConversationMessage> {
    const { data } = await apiClient.post<{ data: ConversationMessage }>(`/public/conversations/${token}/messages`, {
      contenido,
    });
    return data.data;
  },
};
