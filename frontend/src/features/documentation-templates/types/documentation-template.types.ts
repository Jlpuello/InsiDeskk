export type DocumentationTemplateContext = 'cierre_ticket' | 'completar_actividad' | 'motivo_pausa';

export interface DocumentationTemplate {
  id: string;
  titulo: string;
  contenido: string;
  contextos: DocumentationTemplateContext[];
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentationTemplateInput {
  titulo: string;
  contenido: string;
  contextos: DocumentationTemplateContext[];
}

export interface UpdateDocumentationTemplateInput {
  titulo?: string;
  contenido?: string;
  contextos?: DocumentationTemplateContext[];
  activo?: boolean;
}
