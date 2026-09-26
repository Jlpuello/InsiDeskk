import type { DocumentationTemplateContext } from '@prisma/client';
import { documentationTemplateRepository } from '../repositories/documentation-template.repository.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';
import type { CreateDocumentationTemplateDTO, UpdateDocumentationTemplateDTO } from '../types/documentation-template.types.js';

export class DocumentationTemplateService {
  async list(contexto?: DocumentationTemplateContext) {
    if (contexto) return documentationTemplateRepository.findActiveByContext(contexto);
    return documentationTemplateRepository.findMany();
  }

  async create(data: CreateDocumentationTemplateDTO) {
    return documentationTemplateRepository.create({
      titulo: data.titulo,
      contenido: data.contenido,
      contextos: data.contextos,
    });
  }

  async update(id: string, data: UpdateDocumentationTemplateDTO) {
    const existing = await documentationTemplateRepository.findById(id);
    if (!existing) throw new NotFoundError('Plantilla');

    return documentationTemplateRepository.update(id, {
      ...(data.titulo && { titulo: data.titulo }),
      ...(data.contenido && { contenido: data.contenido }),
      ...(data.contextos && { contextos: data.contextos }),
      ...(data.activo !== undefined && { activo: data.activo }),
    });
  }
}

export const documentationTemplateService = new DocumentationTemplateService();
