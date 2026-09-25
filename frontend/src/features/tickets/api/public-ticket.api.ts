import { apiClient } from '../../../shared/api/client.ts';
import type { CreatePublicTicketInput, PublicTicketCategory, Ticket } from '../types/ticket.types.ts';

// Sin autenticación (ver backend: /api/public/tickets, montado sin
// verifyJWT) — pensado para compartir como link a alguien sin cuenta en el
// sistema. apiClient igual manda el header Authorization si hay una sesión
// activa en el navegador, pero el backend lo ignora en estas rutas.
export const publicTicketApi = {
  async listCategories(): Promise<PublicTicketCategory[]> {
    const { data } = await apiClient.get<{ data: PublicTicketCategory[] }>('/public/tickets/categories');
    return data.data;
  },

  // Ya no rechaza NITs desconocidos — `encontrada` le dice al formulario si
  // hace falta pedir el nombre de la empresa antes de seguir (ver
  // PublicTicketForm).
  async verifyCompany(nit: string): Promise<{ encontrada: boolean; company: { id: string; nombre: string } | null }> {
    const { data } = await apiClient.get<{ data: { encontrada: boolean; company: { id: string; nombre: string } | null } }>(
      '/public/tickets/verify-company',
      { params: { nit } },
    );
    return data.data;
  },

  async create(input: CreatePublicTicketInput): Promise<Ticket> {
    const { data } = await apiClient.post<{ data: Ticket }>('/public/tickets', input);
    return data.data;
  },
};
