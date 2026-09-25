import { apiClient } from '../../../shared/api/client.ts';
import type { CreateQuoteInput, Quote, QuoteApprover, QuoteEstado, UpdateQuoteInput } from '../types/quote.types.ts';

// El nombre en disco es "{uuid}__{original saneado}" (ver backend:
// quote-document-upload.middleware.ts) — esto recupera el nombre real para
// mostrar en la lista, sin el prefijo random.
export function documentDisplayName(url: string): string {
  const filename = url.split('/').pop() ?? url;
  return filename.includes('__') ? filename.split('__').slice(1).join('__') : filename;
}

export const quoteApi = {
  async list(filters?: { empresaId?: string; estado?: QuoteEstado; ticketId?: string }): Promise<Quote[]> {
    const { data } = await apiClient.get<{ data: Quote[] }>('/quotes', { params: filters });
    return data.data;
  },

  async listByTicket(ticketId: string): Promise<Quote[]> {
    const { data } = await apiClient.get<{ data: Quote[] }>(`/quotes/by-ticket/${ticketId}`);
    return data.data;
  },

  async listApprovers(empresaId?: string): Promise<QuoteApprover[]> {
    const { data } = await apiClient.get<{ data: QuoteApprover[] }>('/quotes/approvers', { params: { empresaId } });
    return data.data;
  },

  // "Aprobaciones pendientes" del canal logueado — solo lo que este usuario
  // cliente puntual quedó designado a resolver (ver Usuarios para marcar
  // quién puede aparecer acá).
  async listPendingForMe(): Promise<Quote[]> {
    const { data } = await apiClient.get<{ data: Quote[] }>('/quotes/pending-for-me');
    return data.data;
  },

  async getById(id: string): Promise<Quote> {
    const { data } = await apiClient.get<{ data: Quote }>(`/quotes/${id}`);
    return data.data;
  },

  async create(input: CreateQuoteInput): Promise<Quote> {
    const { data } = await apiClient.post<{ data: Quote }>('/quotes', input);
    return data.data;
  },

  async update(id: string, input: UpdateQuoteInput): Promise<Quote> {
    const { data } = await apiClient.put<{ data: Quote }>(`/quotes/${id}`, input);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/quotes/${id}`);
  },

  async send(id: string, contactoAutorizadorId: string): Promise<Quote> {
    const { data } = await apiClient.post<{ data: Quote }>(`/quotes/${id}/send`, { contactoAutorizadorId });
    return data.data;
  },

  async cancel(id: string): Promise<Quote> {
    const { data } = await apiClient.post<{ data: Quote }>(`/quotes/${id}/cancel`);
    return data.data;
  },

  // multipart: 'firmaNombre' + 'firma' (Blob PNG del SignaturePad) — canal
  // autenticado (el usuario logueado tiene que ser el aprobador designado).
  async approve(id: string, firmaNombre: string, firma: Blob): Promise<Quote> {
    const formData = new FormData();
    formData.append('firmaNombre', firmaNombre);
    formData.append('firma', firma, 'firma.png');
    const { data } = await apiClient.post<{ data: Quote }>(`/quotes/${id}/approve`, formData);
    return data.data;
  },

  async reject(id: string, nombre: string, motivo: string): Promise<Quote> {
    const { data } = await apiClient.post<{ data: Quote }>(`/quotes/${id}/reject`, { nombre, motivo });
    return data.data;
  },

  // Documentos de soporte — cotización del proveedor, ficha técnica, fotos.
  async uploadDocuments(id: string, files: File[]): Promise<Quote> {
    const formData = new FormData();
    files.forEach((file) => formData.append('documentos', file));
    const { data } = await apiClient.post<{ data: Quote }>(`/quotes/${id}/documents`, formData);
    return data.data;
  },

  async removeDocument(id: string, url: string): Promise<Quote> {
    const filename = url.split('/').pop();
    const { data } = await apiClient.delete<{ data: Quote }>(`/quotes/${id}/documents/${filename}`);
    return data.data;
  },

  // Descarga el archivo real (con su nombre original, ver
  // QuoteController.getDocument) armando un <a download> efímero — mismo
  // patrón que inventoryApi.exportExcel.
  async downloadDocument(url: string): Promise<void> {
    const { data } = await apiClient.get(url, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(data as Blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = documentDisplayName(url);
    link.click();
    URL.revokeObjectURL(blobUrl);
  },

  async downloadPdf(id: string): Promise<void> {
    const { data } = await apiClient.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(data as Blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'cotizacion.pdf';
    link.click();
    URL.revokeObjectURL(blobUrl);
  },
};
