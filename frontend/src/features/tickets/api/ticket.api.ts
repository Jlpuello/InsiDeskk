import { apiClient } from '../../../shared/api/client.ts';
import type {
  CreateTicketInput,
  NoteType,
  SlaPolicy,
  Ticket,
  TicketCategory,
  TicketCriticidad,
  TicketLevelVisibility,
  TicketNote,
  TicketPriority,
  TicketStatus,
  TicketSubcategory,
} from '../types/ticket.types.ts';

interface CategoryDefaultsPatch {
  prioridadDefault?: TicketPriority | null;
  criticidadDefault?: TicketCriticidad | null;
  nivelRequerido?: number | null;
}

export const ticketApi = {
  async list(params?: {
    empresaId?: string;
    // 'no-cerrado' pide todo menos cerrado (default de la lista); 'sin-asignar'
    // (en usuarioAsignadoId) pide tickets sin técnico asignado — ver
    // TicketService.getTickets en el backend.
    estado?: TicketStatus | 'no-cerrado';
    prioridad?: TicketPriority;
    categoriaId?: string;
    usuarioAsignadoId?: string;
  }): Promise<Ticket[]> {
    const { data } = await apiClient.get<{ data: Ticket[] }>('/tickets', { params });
    return data.data;
  },

  async getById(id: string): Promise<Ticket> {
    const { data } = await apiClient.get<{ data: Ticket }>(`/tickets/${id}`);
    return data.data;
  },

  async create(input: CreateTicketInput): Promise<Ticket> {
    const { data } = await apiClient.post<{ data: Ticket }>('/tickets', input);
    return data.data;
  },

  async update(id: string, input: { usuarioAsignadoId?: string | null }): Promise<Ticket> {
    const { data } = await apiClient.put<{ data: Ticket }>(`/tickets/${id}`, input);
    return data.data;
  },

  async changeStatus(id: string, estado: TicketStatus): Promise<Ticket> {
    const { data } = await apiClient.patch<{ data: Ticket }>(`/tickets/${id}/estado`, { estado });
    return data.data;
  },

  // Único camino para cerrar un ticket — el backend ya no acepta
  // estado=cerrado en changeStatus (ver ticket.controller.ts). multipart
  // porque puede llevar imágenes de evidencia.
  async closeTicket(id: string, contenido: string, imagenes: File[]): Promise<Ticket> {
    const formData = new FormData();
    formData.append('contenido', contenido);
    imagenes.forEach((file) => formData.append('imagenes', file));

    const { data } = await apiClient.post<{ data: Ticket }>(`/tickets/${id}/close`, formData);
    return data.data;
  },

  // Única forma de sacar un ticket de "cerrado" — el backend exige el motivo
  // y lo deja registrado como nota (ver TicketService.reopenTicket).
  async reopenTicket(id: string, motivo: string): Promise<Ticket> {
    const { data } = await apiClient.post<{ data: Ticket }>(`/tickets/${id}/reopen`, { motivo });
    return data.data;
  },

  // Acción crítica — el backend exige motivo y la audita (ver
  // TicketService.deleteTicket).
  async remove(id: string, motivo: string): Promise<void> {
    await apiClient.delete(`/tickets/${id}`, { data: { motivo } });
  },

  async listNotes(ticketId: string): Promise<TicketNote[]> {
    const { data } = await apiClient.get<{ data: TicketNote[] }>(`/tickets/${ticketId}/notes`);
    return data.data;
  },

  async addNote(ticketId: string, contenido: string, tipo?: NoteType): Promise<TicketNote> {
    const { data } = await apiClient.post<{ data: TicketNote }>(`/tickets/${ticketId}/notes`, { contenido, tipo });
    return data.data;
  },

  async removeNote(ticketId: string, noteId: string): Promise<void> {
    await apiClient.delete(`/tickets/${ticketId}/notes/${noteId}`);
  },

  // ── Categorías/subcategorías ─────────────────────────────────────────────
  async listCategories(): Promise<TicketCategory[]> {
    const { data } = await apiClient.get<{ data: TicketCategory[] }>('/tickets/categories');
    return data.data;
  },

  async createCategory(nombre: string, defaults?: CategoryDefaultsPatch): Promise<TicketCategory> {
    const { data } = await apiClient.post<{ data: TicketCategory }>('/tickets/categories', { nombre, ...defaults });
    return data.data;
  },

  async updateCategory(
    id: string,
    input: { nombre?: string; activo?: boolean } & CategoryDefaultsPatch,
  ): Promise<TicketCategory> {
    const { data } = await apiClient.put<{ data: TicketCategory }>(`/tickets/categories/${id}`, input);
    return data.data;
  },

  async createSubcategory(
    categoriaId: string,
    nombre: string,
    defaults?: CategoryDefaultsPatch,
  ): Promise<TicketSubcategory> {
    const { data } = await apiClient.post<{ data: TicketSubcategory }>(
      `/tickets/categories/${categoriaId}/subcategories`,
      { nombre, ...defaults },
    );
    return data.data;
  },

  async updateSubcategory(
    categoriaId: string,
    subcategoryId: string,
    input: { nombre?: string; activo?: boolean } & CategoryDefaultsPatch,
  ): Promise<TicketSubcategory> {
    const { data } = await apiClient.put<{ data: TicketSubcategory }>(
      `/tickets/categories/${categoriaId}/subcategories/${subcategoryId}`,
      input,
    );
    return data.data;
  },

  // ── SLA ──────────────────────────────────────────────────────────────────
  async listSla(): Promise<SlaPolicy[]> {
    const { data } = await apiClient.get<{ data: SlaPolicy[] }>('/tickets/sla');
    return data.data;
  },

  async updateSla(
    prioridad: TicketPriority,
    criticidad: TicketCriticidad,
    input: { tiempoRespuestaMin: number; tiempoResolucionMin: number },
  ): Promise<SlaPolicy> {
    const { data } = await apiClient.put<{ data: SlaPolicy }>(`/tickets/sla/${prioridad}/${criticidad}`, input);
    return data.data;
  },

  // ── Visibilidad por nivel ────────────────────────────────────────────────
  async listNivelVisibility(): Promise<TicketLevelVisibility[]> {
    const { data } = await apiClient.get<{ data: TicketLevelVisibility[] }>('/tickets/nivel-visibilidad');
    return data.data;
  },

  async updateNivelVisibility(nivelTecnico: number, nivelTicket: number, visible: boolean): Promise<TicketLevelVisibility> {
    const { data } = await apiClient.put<{ data: TicketLevelVisibility }>(
      `/tickets/nivel-visibilidad/${nivelTecnico}/${nivelTicket}`,
      { visible },
    );
    return data.data;
  },
};
