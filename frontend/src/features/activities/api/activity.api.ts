import { apiClient } from '../../../shared/api/client.ts';
import type {
  Activity,
  ActivityFollowup,
  ActivityStatus,
  ActivityTemplate,
  ActivityType,
  Acta,
  CreateActivityInput,
  CreateActivityTemplateInput,
  UpdateActivityInput,
  UpdateActivityTemplateInput,
} from '../types/activity.types.ts';

export const activityApi = {
  async list(params?: {
    empresaId?: string;
    estado?: ActivityStatus;
    tipo?: ActivityType;
    usuarioAsignadoId?: string;
  }): Promise<Activity[]> {
    const { data } = await apiClient.get<{ data: Activity[] }>('/activities', { params });
    return data.data;
  },

  async getById(id: string): Promise<Activity> {
    const { data } = await apiClient.get<{ data: Activity }>(`/activities/${id}`);
    return data.data;
  },

  async create(input: CreateActivityInput): Promise<Activity> {
    const { data } = await apiClient.post<{ data: Activity }>('/activities', input);
    return data.data;
  },

  async update(id: string, input: UpdateActivityInput): Promise<Activity> {
    const { data } = await apiClient.put<{ data: Activity }>(`/activities/${id}`, input);
    return data.data;
  },

  // 'completada' no se acepta acá — el backend lo rechaza, ver completeActivity.
  // motivo es obligatorio del lado del backend solo al pausar
  // (estado='pendiente' viniendo de 'en_progreso') — ver ActivityController#statusSchema.
  async changeStatus(id: string, estado: ActivityStatus, motivo?: string): Promise<Activity> {
    const { data } = await apiClient.patch<{ data: Activity }>(`/activities/${id}/estado`, { estado, motivo });
    return data.data;
  },

  // Único camino para completar una actividad — multipart porque puede
  // llevar hasta 5 fotos de evidencia (ver CompleteActivityModal).
  async completeActivity(id: string, resultado: string, imagenes: File[]): Promise<Activity> {
    const formData = new FormData();
    formData.append('resultado', resultado);
    imagenes.forEach((file) => formData.append('imagenes', file));

    const { data } = await apiClient.post<{ data: Activity }>(`/activities/${id}/complete`, formData);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/activities/${id}`);
  },

  async listFollowups(id: string): Promise<ActivityFollowup[]> {
    const { data } = await apiClient.get<{ data: ActivityFollowup[] }>(`/activities/${id}/followups`);
    return data.data;
  },

  async addFollowup(id: string, contenido: string): Promise<ActivityFollowup> {
    const { data } = await apiClient.post<{ data: ActivityFollowup }>(`/activities/${id}/followups`, { contenido });
    return data.data;
  },

  // ── Plantillas recurrentes ───────────────────────────────────────────────
  async listTemplates(empresaId?: string): Promise<ActivityTemplate[]> {
    const { data } = await apiClient.get<{ data: ActivityTemplate[] }>('/activities/templates', {
      params: { empresaId },
    });
    return data.data;
  },

  async createTemplate(input: CreateActivityTemplateInput): Promise<ActivityTemplate> {
    const { data } = await apiClient.post<{ data: ActivityTemplate }>('/activities/templates', input);
    return data.data;
  },

  async updateTemplate(id: string, input: UpdateActivityTemplateInput): Promise<ActivityTemplate> {
    const { data } = await apiClient.put<{ data: ActivityTemplate }>(`/activities/templates/${id}`, input);
    return data.data;
  },

  // ── Acta de entrega ──────────────────────────────────────────────────────
  // multipart: firmaNombre (texto) + firma (Blob PNG del canvas). Sin
  // contenido: el backend lo toma de activity.resultado (ver acta.service.ts).
  async createActa(id: string, firmaNombre: string, firma: Blob): Promise<Acta> {
    const formData = new FormData();
    formData.append('firmaNombre', firmaNombre);
    formData.append('firma', firma, 'firma.png');

    const { data } = await apiClient.post<{ data: Acta }>(`/activities/${id}/acta`, formData);
    return data.data;
  },

  async sendActa(activityId: string, actaId: string, to: string): Promise<Acta> {
    const { data } = await apiClient.post<{ data: Acta }>(`/activities/${activityId}/acta/${actaId}/send`, { to });
    return data.data;
  },

  // El acta ya se puede enviar por correo y ver la firma en pantalla, pero el
  // PDF generado en sí no tenía ningún botón de descarga — mismo patrón blob
  // que quoteApi.downloadPdf.
  async downloadActaPdf(id: string): Promise<void> {
    const { data } = await apiClient.get(`/activities/${id}/acta/pdf`, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(data as Blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'acta-de-entrega.pdf';
    link.click();
    URL.revokeObjectURL(blobUrl);
  },
};
