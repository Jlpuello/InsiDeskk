import { apiClient } from '../../../shared/api/client.ts';
import type { DeviceStats, TicketPriority, TicketStats, TicketTrendPoint } from '../types/dashboard.types.ts';

export const dashboardApi = {
  async getTicketStats(): Promise<TicketStats> {
    const { data } = await apiClient.get<{ data: TicketStats }>('/tickets/stats');
    return data.data;
  },

  async getDeviceStats(): Promise<DeviceStats> {
    const { data } = await apiClient.get<{ data: DeviceStats }>('/devices/stats');
    return data.data;
  },

  // KPI "Mis tickets" — cuenta del usuario logueado, sin filtros por query
  // (ver TicketController.myOpenCount en el backend).
  async getMyOpenTicketsCount(): Promise<number> {
    const { data } = await apiClient.get<{ data: { count: number } }>('/tickets/stats/mine');
    return data.data.count;
  },

  async getTicketsByPriority(): Promise<Record<TicketPriority, number>> {
    const { data } = await apiClient.get<{ data: Record<TicketPriority, number> }>('/tickets/stats/by-priority');
    return data.data;
  },

  // Últimos 14 días, uno por día (sin huecos — ver TicketService.getTicketTrend).
  async getTicketTrend(): Promise<TicketTrendPoint[]> {
    const { data } = await apiClient.get<{ data: TicketTrendPoint[] }>('/tickets/stats/trend');
    return data.data;
  },
};
