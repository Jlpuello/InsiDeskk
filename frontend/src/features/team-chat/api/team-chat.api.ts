import { apiClient } from '../../../shared/api/client.ts';
import type { TeamChannelSummary, TeamMessage } from '../types/team-chat.types.ts';

// Chat interno de equipo (admin/tecnico) — ver backend/features/team-chat/.
// Sin lado público, a diferencia de conversationApi/conversationPublicApi.
export const teamChatApi = {
  async listChannels(): Promise<TeamChannelSummary[]> {
    const { data } = await apiClient.get<{ data: TeamChannelSummary[] }>('/team-chat/channels');
    return data.data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ data: { count: number } }>('/team-chat/channels/unread-count');
    return data.data.count;
  },

  async getOrCreateDm(userId: string): Promise<TeamChannelSummary> {
    const { data } = await apiClient.post<{ data: TeamChannelSummary }>('/team-chat/channels/dm', { userId });
    return data.data;
  },

  async createGroup(nombre: string, miembroIds: string[]): Promise<TeamChannelSummary> {
    const { data } = await apiClient.post<{ data: TeamChannelSummary }>('/team-chat/channels', {
      nombre,
      miembroIds,
    });
    return data.data;
  },

  async getMessages(channelId: string): Promise<TeamMessage[]> {
    const { data } = await apiClient.get<{ data: TeamMessage[] }>(`/team-chat/channels/${channelId}/messages`);
    return data.data;
  },

  async postMessage(channelId: string, contenido: string): Promise<TeamMessage> {
    const { data } = await apiClient.post<{ data: TeamMessage }>(`/team-chat/channels/${channelId}/messages`, {
      contenido,
    });
    return data.data;
  },

  async addMember(channelId: string, userId: string): Promise<void> {
    await apiClient.post(`/team-chat/channels/${channelId}/members`, { userId });
  },

  async removeMember(channelId: string, userId: string): Promise<void> {
    await apiClient.delete(`/team-chat/channels/${channelId}/members/${userId}`);
  },
};
