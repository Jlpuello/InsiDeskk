import { apiClient } from '../../../shared/api/client.ts';
import type { Quote } from '../types/quote.types.ts';

// Sin autenticación (ver backend: /api/public/quotes, montado sin
// verifyJWT) — el link de aprobación por correo apunta acá.
export const publicQuoteApi = {
  async getByToken(token: string): Promise<Quote> {
    const { data } = await apiClient.get<{ data: Quote }>(`/public/quotes/${token}`);
    return data.data;
  },

  async approve(token: string, firmaNombre: string, firma: Blob): Promise<Quote> {
    const formData = new FormData();
    formData.append('firmaNombre', firmaNombre);
    formData.append('firma', firma, 'firma.png');
    const { data } = await apiClient.post<{ data: Quote }>(`/public/quotes/${token}/approve`, formData);
    return data.data;
  },

  async reject(token: string, nombre: string, motivo: string): Promise<Quote> {
    const { data } = await apiClient.post<{ data: Quote }>(`/public/quotes/${token}/reject`, { nombre, motivo });
    return data.data;
  },
};
