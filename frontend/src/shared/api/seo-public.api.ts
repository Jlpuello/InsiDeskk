import { apiClient } from './client.ts';

// Título/descripción/keywords cargados en Configuración → SEO — sin
// autenticación (ver backend: GET /api/public/settings/seo), consumido por
// useSeoMeta en las páginas públicas.
export interface SeoPublicInfo {
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
  seoMetaKeywords: string | null;
}

export const seoPublicApi = {
  async get(): Promise<SeoPublicInfo> {
    const { data } = await apiClient.get<{ data: SeoPublicInfo }>('/public/settings/seo');
    return data.data;
  },
};
