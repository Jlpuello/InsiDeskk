import type { DocumentationTemplateContext } from '@prisma/client';

export interface CreateDocumentationTemplateDTO {
  titulo: string;
  contenido: string;
  contextos: DocumentationTemplateContext[];
}

export interface UpdateDocumentationTemplateDTO {
  titulo?: string;
  contenido?: string;
  contextos?: DocumentationTemplateContext[];
  activo?: boolean;
}
