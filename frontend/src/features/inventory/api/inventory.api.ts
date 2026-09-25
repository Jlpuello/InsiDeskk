import { apiClient } from '../../../shared/api/client.ts';
import type {
  InventoryEquipment,
  InventoryEquipmentInput,
  InventoryFilters,
  InventoryListItem,
} from '../types/inventory.types.ts';

export const inventoryApi = {
  // Lista combinada: equipo cargado a mano + PCs con agente (ver
  // InventoryListItem) — un solo endpoint, discriminado por `origen`.
  async list(filters?: InventoryFilters): Promise<InventoryListItem[]> {
    const { data } = await apiClient.get<{ data: InventoryListItem[] }>('/inventory', { params: filters });
    return data.data;
  },

  async getById(id: string): Promise<InventoryEquipment> {
    const { data } = await apiClient.get<{ data: InventoryEquipment }>(`/inventory/${id}`);
    return data.data;
  },

  async create(input: InventoryEquipmentInput): Promise<InventoryEquipment> {
    const { data } = await apiClient.post<{ data: InventoryEquipment }>('/inventory', input);
    return data.data;
  },

  async update(id: string, input: Partial<Omit<InventoryEquipmentInput, 'empresaId'>>): Promise<InventoryEquipment> {
    const { data } = await apiClient.put<{ data: InventoryEquipment }>(`/inventory/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/inventory/${id}`);
  },

  // Descarga directa del .xlsx (general si no hay filtros, filtrado si los
  // hay — mismo endpoint, ver backend) y dispara el guardado del archivo en
  // el navegador armando un <a download> efímero.
  async exportExcel(filters?: InventoryFilters): Promise<void> {
    const { data } = await apiClient.get('/inventory/export', { params: filters, responseType: 'blob' });
    const url = URL.createObjectURL(data as Blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'inventario.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  },
};
