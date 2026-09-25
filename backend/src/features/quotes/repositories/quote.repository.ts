import { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

// `select: safeUserSelect` en vez de `include: true` para creadoPor/
// contactoAutorizador — un `include: true` en una relación de User trae
// passwordHash, y esto sale por endpoints PÚBLICOS (ver public-quote
// controller), no solo autenticados. Mismo criterio que
// ticket.repository.ts/acta.repository.ts.
const DEFAULT_INCLUDE = {
  lineas: true,
  ticket: true,
  empresa: true,
  creadoPor: { select: safeUserSelect },
  contactoAutorizador: { select: safeUserSelect },
} satisfies Prisma.QuoteInclude;

export class QuoteRepository {
  private get prisma() {
    return getPrismaClient();
  }

  // Sin anotar el tipo de retorno a mano — Prisma infiere la forma completa
  // (con los includes de arriba); anotarlo a mano la trunca silenciosamente
  // (mismo motivo documentado en inventory.repository.ts).
  async create(data: Prisma.QuoteCreateInput) {
    return this.prisma.quote.create({ data, include: DEFAULT_INCLUDE });
  }

  async findById(id: string) {
    return this.prisma.quote.findUnique({ where: { id }, include: DEFAULT_INCLUDE });
  }

  // El token se guarda hasheado (ver quote-token.service.ts) — nunca se busca
  // por el valor en claro.
  async findByTokenHash(tokenHash: string) {
    return this.prisma.quote.findUnique({ where: { tokenHash }, include: DEFAULT_INCLUDE });
  }

  async findByTicketId(ticketId: string) {
    return this.prisma.quote.findMany({
      where: { ticketId },
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPendingByTicketId(ticketId: string) {
    return this.prisma.quote.findFirst({
      where: { ticketId, estado: 'pendiente_aprobacion' },
      include: DEFAULT_INCLUDE,
    });
  }

  // "Aprobaciones pendientes" del canal logueado (ver public-quote vs. quote
  // controller) — solo lo que este usuario cliente puntual quedó designado a
  // resolver.
  async findPendingForApprover(contactoAutorizadorId: string) {
    return this.prisma.quote.findMany({
      where: { contactoAutorizadorId, estado: 'pendiente_aprobacion' },
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  // Usado por el scheduler de expiración — todo lo que sigue pendiente pero
  // ya venció su token.
  async findExpiredPending(now: Date) {
    return this.prisma.quote.findMany({
      where: { estado: 'pendiente_aprobacion', tokenExpiresAt: { lt: now } },
      include: DEFAULT_INCLUDE,
    });
  }

  async findMany(filters: { empresaId?: string; estado?: string; ticketId?: string }) {
    return this.prisma.quote.findMany({
      where: {
        ...(filters.empresaId && { empresaId: filters.empresaId }),
        ...(filters.estado && { estado: filters.estado as never }),
        ...(filters.ticketId && { ticketId: filters.ticketId }),
      },
      include: DEFAULT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.QuoteUpdateInput) {
    return this.prisma.quote.update({ where: { id }, data, include: DEFAULT_INCLUDE });
  }

  // Reemplaza todas las líneas de una cotización en borrador — más simple que
  // diffear altas/bajas/ediciones línea por línea para un caso de uso donde
  // el formulario siempre manda la lista completa (ver QuoteFormModal).
  async replaceLineItems(quoteId: string, lineas: Omit<Prisma.QuoteLineItemCreateManyInput, 'quoteId'>[]) {
    await this.prisma.quoteLineItem.deleteMany({ where: { quoteId } });
    if (lineas.length > 0) {
      await this.prisma.quoteLineItem.createMany({ data: lineas.map((l) => ({ ...l, quoteId })) });
    }
  }

  async delete(id: string) {
    return this.prisma.quote.delete({ where: { id } });
  }
}

export const quoteRepository = new QuoteRepository();
