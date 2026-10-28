import { apiClient } from '../../../shared/api/client.ts';
import type {
  ExecuteScriptResult,
  HardwareScanResult,
  NetworkScanResult,
  RemoteSessionHistoryEntry,
  RemotelyDeviceGroup,
  ScriptExecutionEntry,
  SoftwareScanResult,
  StartSessionResult,
} from '../types/remotely.types.ts';

export const remotelyApi = {
  async listGroups(): Promise<RemotelyDeviceGroup[]> {
    const { data } = await apiClient.get<{ data: RemotelyDeviceGroup[] }>('/remotely/groups');
    return data.data;
  },

  async connect(deviceId: string, ticketId?: string): Promise<StartSessionResult> {
    const { data } = await apiClient.post<{ data: StartSessionResult }>(`/remotely/connect/${deviceId}`, {
      ticketId,
    });
    return data.data;
  },

  // Conexión ad-hoc por código (equipo sin registrar en Inventario) — ver
  // RemoteConnectPage.
  async attendedConnect(sessionId: string): Promise<StartSessionResult> {
    const { data } = await apiClient.post<{ data: StartSessionResult }>('/remotely/attended-connect', { sessionId });
    return data.data;
  },

  async executeScript(
    deviceId: string,
    shell: 'powershell' | 'bash' | 'cmd',
    script: string,
  ): Promise<ExecuteScriptResult> {
    const { data } = await apiClient.post<{ data: ExecuteScriptResult }>('/remotely/execute-script', {
      deviceId,
      shell,
      script,
    });
    return data.data;
  },

  async sessionHistory(deviceId: string): Promise<RemoteSessionHistoryEntry[]> {
    const { data } = await apiClient.get<{ data: RemoteSessionHistoryEntry[] }>(`/remotely/sessions/${deviceId}`);
    return data.data;
  },

  async scriptHistory(deviceId: string): Promise<ScriptExecutionEntry[]> {
    const { data } = await apiClient.get<{ data: ScriptExecutionEntry[] }>(`/remotely/scripts/${deviceId}`);
    return data.data;
  },

  async hardwareScan(deviceId: string): Promise<HardwareScanResult> {
    const { data } = await apiClient.post<{ data: HardwareScanResult }>(`/remotely/hardware-scan/${deviceId}`);
    return data.data;
  },

  async networkScan(deviceId: string): Promise<NetworkScanResult> {
    const { data } = await apiClient.post<{ data: NetworkScanResult }>(`/remotely/network-scan/${deviceId}`);
    return data.data;
  },

  async softwareScan(deviceId: string): Promise<SoftwareScanResult> {
    const { data } = await apiClient.post<{ data: SoftwareScanResult }>(`/remotely/software-scan/${deviceId}`);
    return data.data;
  },
};
