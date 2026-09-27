import { apiClient } from './client.ts';

// Identidad legal de la empresa que opera esta instancia — razón
// social/NIT/teléfono/email cargados en Configuración → Organización. Sin
// autenticación (ver backend: GET /api/public/settings/organization), usado
// por la home pública, el login y el pie de los informes imprimibles
// (TicketReport/DeviceReport/InventoryReport) para que quien vea el reporte
// no necesite estar logueado como admin para que aparezca el membrete.
export interface OrganizationPublicInfo {
  razonSocial: string | null;
  nit: string | null;
  telefono: string | null;
  email: string | null;
}

export const organizationPublicApi = {
  async get(): Promise<OrganizationPublicInfo> {
    const { data } = await apiClient.get<{ data: OrganizationPublicInfo }>('/public/settings/organization');
    return data.data;
  },
};
