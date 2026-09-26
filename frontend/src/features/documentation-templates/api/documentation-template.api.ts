import { apiClient } from '../../../shared/api/client.ts';
import type {
  CreateDocumentationTemplateInput,
  DocumentationTemplate,
  DocumentationTemplateContext,
  UpdateDocumentationTemplateInput,
} from '../types/documentation-template.types.ts';

export const documentationTemplateApi = {
  // Sin contexto: todas (para la pantalla de administración). Con contexto:
  // solo las activas que aplican (para los selectores de cierre/completar/pausa).
  async list(contexto?: DocumentationTemplateContext): Promise<DocumentationTemplate[]> {
    const { data } = await apiClient.get<{ data: DocumentationTemplate[] }>('/documentation-templates', {
      params: contexto ? { contexto } : undefined,
    });
    return data.data;
  },

  async create(input: CreateDocumentationTemplateInput): Promise<DocumentationTemplate> {
    const { data } = await apiClient.post<{ data: DocumentationTemplate }>('/documentation-templates', input);
    return data.data;
  },

  async update(id: string, input: UpdateDocumentationTemplateInput): Promise<DocumentationTemplate> {
    const { data } = await apiClient.put<{ data: DocumentationTemplate }>(`/documentation-templates/${id}`, input);
    return data.data;
  },
};
