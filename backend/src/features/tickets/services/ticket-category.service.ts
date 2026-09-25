import type { TicketCategory, TicketCriticidad, TicketPriority, TicketSubcategory } from '@prisma/client';
import { ticketCategoryRepository } from '../repositories/ticket-category.repository.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';

interface CategoryDefaultsInput {
  prioridadDefault?: TicketPriority | null;
  criticidadDefault?: TicketCriticidad | null;
  nivelRequerido?: number | null;
}

export interface ResolvedDefaults {
  prioridad: TicketPriority | null;
  criticidad: TicketCriticidad | null;
  nivelRequerido: number | null;
}

export class TicketCategoryService {
  async list() {
    return ticketCategoryRepository.findMany();
  }

  async create(nombre: string, defaults?: CategoryDefaultsInput): Promise<TicketCategory> {
    return ticketCategoryRepository.create({ nombre, ...defaults });
  }

  async update(
    id: string,
    input: { nombre?: string; activo?: boolean } & CategoryDefaultsInput,
  ): Promise<TicketCategory> {
    const existing = await ticketCategoryRepository.findById(id);
    if (!existing) throw new NotFoundError('Categoría');
    return ticketCategoryRepository.update(id, input);
  }

  async createSubcategory(
    categoriaId: string,
    nombre: string,
    defaults?: CategoryDefaultsInput,
  ): Promise<TicketSubcategory> {
    const categoria = await ticketCategoryRepository.findById(categoriaId);
    if (!categoria) throw new NotFoundError('Categoría');
    return ticketCategoryRepository.createSubcategory({
      nombre,
      ...defaults,
      categoria: { connect: { id: categoriaId } },
    });
  }

  async updateSubcategory(
    id: string,
    input: { nombre?: string; activo?: boolean } & CategoryDefaultsInput,
  ): Promise<TicketSubcategory> {
    const existing = await ticketCategoryRepository.findSubcategoryById(id);
    if (!existing) throw new NotFoundError('Subcategoría');
    return ticketCategoryRepository.updateSubcategory(id, input);
  }

  // Fija prioridad/criticidad según la categoría/subcategoría del ticket —
  // la subcategoría gana campo por campo sobre la categoría (si la
  // subcategoría no fija criticidad pero la categoría sí, se usa la de la
  // categoría). Devuelve null en un campo si ningún nivel lo fija, dejando
  // que el llamador caiga al valor libre (manual o 'media' por defecto).
  async resolveDefaults(categoriaId?: string | null, subcategoriaId?: string | null): Promise<ResolvedDefaults | null> {
    let effectiveCategoriaId = categoriaId ?? undefined;
    let subPrioridad: TicketPriority | null = null;
    let subCriticidad: TicketCriticidad | null = null;
    let subNivel: number | null = null;

    if (subcategoriaId) {
      const sub = await ticketCategoryRepository.findSubcategoryById(subcategoriaId);
      if (!sub) throw new NotFoundError('Subcategoría');
      subPrioridad = sub.prioridadDefault;
      subCriticidad = sub.criticidadDefault;
      subNivel = sub.nivelRequerido;
      effectiveCategoriaId = effectiveCategoriaId ?? sub.categoriaId;
    }

    let catPrioridad: TicketPriority | null = null;
    let catCriticidad: TicketCriticidad | null = null;
    let catNivel: number | null = null;
    if (effectiveCategoriaId) {
      const cat = await ticketCategoryRepository.findById(effectiveCategoriaId);
      if (!cat) throw new NotFoundError('Categoría');
      catPrioridad = cat.prioridadDefault;
      catCriticidad = cat.criticidadDefault;
      catNivel = cat.nivelRequerido;
    }

    const prioridad = subPrioridad ?? catPrioridad;
    const criticidad = subCriticidad ?? catCriticidad;
    const nivelRequerido = subNivel ?? catNivel;
    if (!prioridad && !criticidad && !nivelRequerido) return null;
    return { prioridad, criticidad, nivelRequerido };
  }
}

export const ticketCategoryService = new TicketCategoryService();
