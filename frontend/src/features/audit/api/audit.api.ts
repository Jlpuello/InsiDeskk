import { apiClient } from '../../../shared/api/client.ts';
import type { AuditLogEntry, FailedLoginEntry } from '../types/audit.types.ts';

export interface AuditLogFilters {
  usuarioId?: string;
  accion?: string;
  tabla?: string;
  resultado?: 'success' | 'failure';
  soloConMotivo?: boolean;
  desde?: string;
  hasta?: string;
  skip?: number;
  take?: number;
}

export interface FailedLoginFilters {
  email?: string;
  ipAddress?: string;
  desde?: string;
  hasta?: string;
  skip?: number;
  take?: number;
}

export const auditApi = {
  async listLogs(filters: AuditLogFilters): Promise<{ data: AuditLogEntry[]; total: number }> {
    const { data } = await apiClient.get<{ data: AuditLogEntry[]; total: number }>('/audit/logs', {
      params: filters,
    });
    return data;
  },

  async listAcciones(): Promise<string[]> {
    const { data } = await apiClient.get<{ data: string[] }>('/audit/logs/acciones');
    return data.data;
  },

  async listTablas(): Promise<string[]> {
    const { data } = await apiClient.get<{ data: string[] }>('/audit/logs/tablas');
    return data.data;
  },

  async listFailedLogins(filters: FailedLoginFilters): Promise<{ data: FailedLoginEntry[]; total: number }> {
    const { data } = await apiClient.get<{ data: FailedLoginEntry[]; total: number }>('/audit/failed-logins', {
      params: filters,
    });
    return data;
  },
};
