import { Prisma, type TicketCategory, type TicketSubcategory } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class TicketCategoryRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async findMany(): Promise<(TicketCategory & { subcategorias: TicketSubcategory[] })[]> {
    return this.prisma.ticketCategory.findMany({
      orderBy: { nombre: 'asc' },
      include: { subcategorias: { orderBy: { nombre: 'asc' } } },
    });
  }

  async findById(id: string) {
    return this.prisma.ticketCategory.findUnique({ where: { id } });
  }

  async create(data: Prisma.TicketCategoryCreateInput): Promise<TicketCategory> {
    return this.prisma.ticketCategory.create({ data });
  }

  async update(id: string, data: Prisma.TicketCategoryUpdateInput): Promise<TicketCategory> {
    return this.prisma.ticketCategory.update({ where: { id }, data });
  }

  async findSubcategoryById(id: string) {
    return this.prisma.ticketSubcategory.findUnique({ where: { id } });
  }

  async createSubcategory(data: Prisma.TicketSubcategoryCreateInput): Promise<TicketSubcategory> {
    return this.prisma.ticketSubcategory.create({ data });
  }

  async updateSubcategory(id: string, data: Prisma.TicketSubcategoryUpdateInput): Promise<TicketSubcategory> {
    return this.prisma.ticketSubcategory.update({ where: { id }, data });
  }
}

export const ticketCategoryRepository = new TicketCategoryRepository();
