import { apiClient } from '../../../shared/api/client.ts';
import type { ChatbotTree } from '../../chatbot/types/chatbot.types.ts';

// Sin autenticación (ver backend: /api/public/chatbot, montado sin
// verifyJWT) — usado por la landing de soporte (/soporte). null si el admin
// no activó ningún árbol todavía (ver ChatbotConfigService.getForPublic).
export const chatbotPublicApi = {
  async getConfig(): Promise<ChatbotTree | null> {
    const { data } = await apiClient.get<{ data: ChatbotTree | null }>('/public/chatbot/config');
    return data.data;
  },
};
