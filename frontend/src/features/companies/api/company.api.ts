import { apiClient } from '../../../shared/api/client.ts';
import type { Company, CompanyFormInput } from '../types/company.types.ts';

export const companyApi = {
  async list(): Promise<Company[]> {
    const { data } = await apiClient.get<{ data: Company[] }>('/companies');
    return data.data;
  },

  async create(input: CompanyFormInput): Promise<Company> {
    const { data } = await apiClient.post<{ data: Company }>('/companies', input);
    return data.data;
  },

  async update(id: string, input: Partial<CompanyFormInput>): Promise<Company> {
    const { data } = await apiClient.put<{ data: Company }>(`/companies/${id}`, input);
    return data.data;
  },

  // Acción crítica — el backend exige motivo y la audita con detalle (ver
  // CompanyService.deactivate).
  async deactivate(id: string, motivo: string): Promise<Company> {
    const { data } = await apiClient.post<{ data: Company }>(`/companies/${id}/deactivate`, { motivo });
    return data.data;
  },

  // Reactivar no es una acción crítica (a diferencia de desactivar) — es
  // "deshacer" algo reversible, así que va por el update genérico, sin
  // motivo. Ver updateSchema en company.controller.ts (acepta `activo` suelto).
  async reactivate(id: string): Promise<Company> {
    const { data } = await apiClient.put<{ data: Company }>(`/companies/${id}`, { activo: true });
    return data.data;
  },

  // Mismo criterio que reactivate: no es una acción crítica, es marcar como
  // revisada una empresa autogenerada por la landing pública (ver
  // companyService.resolveOrProvisionByNit en el backend).
  async markVerified(id: string): Promise<Company> {
    const { data } = await apiClient.put<{ data: Company }>(`/companies/${id}`, { verificado: true });
    return data.data;
  },
};
