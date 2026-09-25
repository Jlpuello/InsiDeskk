import { apiClient } from '../../../shared/api/client.ts';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResult {
  text?: string;
  // La IA nunca ejecuta esto ella misma — es una intención que el widget usa
  // para precargar el flujo de ticket/chat en vivo ya existente (ver
  // FloatingSupportWidget.tsx).
  toolCall?: { name: string; input: Record<string, unknown> };
}

// Sin autenticación (ver backend: /api/public/ai-chat, montado sin
// verifyJWT) — sin estado del lado del servidor, el historial completo se
// manda en cada mensaje.
export const aiChatPublicApi = {
  async getStatus(): Promise<boolean> {
    const { data } = await apiClient.get<{ data: { enabled: boolean } }>('/public/ai-chat/status');
    return data.data.enabled;
  },

  async chat(messages: AiChatMessage[]): Promise<AiChatResult> {
    const { data } = await apiClient.post<{ data: AiChatResult }>('/public/ai-chat', { messages });
    return data.data;
  },
};
