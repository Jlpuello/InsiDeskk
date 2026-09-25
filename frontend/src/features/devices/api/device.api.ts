import { apiClient } from '../../../shared/api/client.ts';
import type { Device, DeviceStatus, DeviceTelemetry, OperatingSystem } from '../types/device.types.ts';

export interface DeviceFormInput {
  nombre: string;
  empresaId?: string;
  hostname?: string;
  so?: OperatingSystem;
  versionSo?: string;
  ipLocal?: string;
  ipPublica?: string;
  cpuCores?: number;
  ramGb?: number;
  discoGb?: number;
}

export const deviceApi = {
  async list(params?: { empresaId?: string; estado?: DeviceStatus }): Promise<Device[]> {
    const { data } = await apiClient.get<{ data: Device[] }>('/devices', { params });
    return data.data;
  },

  async getById(id: string): Promise<Device> {
    const { data } = await apiClient.get<{ data: Device }>(`/devices/${id}`);
    return data.data;
  },

  async getStatus(id: string): Promise<DeviceStatus> {
    const { data } = await apiClient.get<{ data: { status: DeviceStatus } }>(`/devices/${id}/status`);
    return data.data.status;
  },

  async getTelemetry(id: string): Promise<DeviceTelemetry | null> {
    const { data } = await apiClient.get<{ data: DeviceTelemetry | null }>(`/devices/${id}/telemetry`);
    return data.data;
  },

  // Alta manual — la mayoría de los equipos llegan solos vía el agente/
  // Remotely, esto es para el caso excepcional de una PC sin agente que igual
  // se quiere llevar en el sistema.
  async create(input: DeviceFormInput): Promise<Device> {
    const { data } = await apiClient.post<{ data: Device }>('/devices', input);
    return data.data;
  },

  async update(id: string, input: Partial<DeviceFormInput>): Promise<Device> {
    const { data } = await apiClient.put<{ data: Device }>(`/devices/${id}`, input);
    return data.data;
  },

  // Acción crítica — el backend exige motivo y la audita (ver
  // DeviceService.remove).
  async remove(id: string, motivo: string): Promise<void> {
    await apiClient.delete(`/devices/${id}`, { data: { motivo } });
  },
};
