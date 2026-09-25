import { apiClient } from '../../../shared/api/client.ts';
import type { ChatbotConfig, ChatbotTree } from '../types/chatbot.types.ts';

export const chatbotApi = {
  async getConfig(): Promise<ChatbotConfig> {
    const { data } = await apiClient.get<{ data: ChatbotConfig }>('/chatbot/config');
    return data.data;
  },

  async updateConfig(activo: boolean, arbol: ChatbotTree): Promise<ChatbotConfig> {
    const { data } = await apiClient.put<{ data: ChatbotConfig }>('/chatbot/config', { activo, arbol });
    return data.data;
  },
};
