import { Prisma, type DocumentationTemplateContext } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class DocumentationTemplateRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.DocumentationTemplateCreateInput) {
    return this.prisma.documentationTemplate.create({ data });
  }

  async findById(id: string) {
    return this.prisma.documentationTemplate.findUnique({ where: { id } });
  }

  async findMany() {
    return this.prisma.documentationTemplate.findMany({ orderBy: { titulo: 'asc' } });
  }

  // `has` filtra por contenido del array (Postgres) — sin esto habría que
  // traer todas y filtrar en JS.
  async findActiveByContext(contexto: DocumentationTemplateContext) {
    return this.prisma.documentationTemplate.findMany({
      where: { activo: true, contextos: { has: contexto } },
      orderBy: { titulo: 'asc' },
    });
  }

  async update(id: string, data: Prisma.DocumentationTemplateUpdateInput) {
    return this.prisma.documentationTemplate.update({ where: { id }, data });
  }
}

export const documentationTemplateRepository = new DocumentationTemplateRepository();
