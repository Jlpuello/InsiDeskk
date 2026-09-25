import { apiClient } from '../../../shared/api/client.ts';
import type { AppNotification } from '../types/notification.types.ts';

export const notificationApi = {
  async listMine(skip = 0, take = 20): Promise<{ data: AppNotification[]; total: number }> {
    const { data } = await apiClient.get<{ data: AppNotification[]; total: number }>('/notifications/mine', {
      params: { skip, take },
    });
    return data;
  },

  async unreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ data: { count: number } }>('/notifications/mine/unread-count');
    return data.data.count;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.post(`/notifications/mine/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/notifications/mine/read-all');
  },
};
