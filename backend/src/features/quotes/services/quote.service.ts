import fs from 'node:fs';
import path from 'node:path';
import { Prisma, type QuoteEstado, type TicketStatus } from '@prisma/client';
import { quoteRepository } from '../repositories/quote.repository.js';
import { quoteTokenService } from './quote-token.service.js';
import { generateQuotePdf } from './quote-pdf.service.js';
import { ticketService } from '../../tickets/services/ticket.service.js';
import { ticketHistoryRepository } from '../../tickets/repositories/ticket-history.repository.js';
import { userRepository } from '../../users/repositories/user.repository.js';
import { NotificationService } from '../../notifications/services/notification.service.js';
import { hasPermission } from '../../../shared/security/permissions.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError, ForbiddenError, NotFoundError } from '../../../shared/utils/error.handler.js';
import type {
  ApproveQuoteInput,
  CreateQuoteDTO,
  QuoteLineItemInput,
  RejectQuoteInput,
  UpdateQuoteDTO,
} from '../types/quote.types.js';

const notificationService = new NotificationService();

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Subtotal por línea + impuesto de esa línea — cantidad*valorUnitario es la
// base, porcentajeImpuesto se aplica sobre esa base (no sobre el total
// general, para que cada línea pueda llevar una tasa distinta, ej. servicios
// exentos vs. insumos gravados).
function computeLineTotals(linea: QuoteLineItemInput) {
  const base = round2(linea.cantidad * linea.valorUnitario);
  const impuesto = round2(base * ((linea.porcentajeImpuesto ?? 0) / 100));
  return { base, impuesto, subtotal: round2(base + impuesto) };
}

function computeQuoteTotals(lineas: QuoteLineItemInput[]) {
  let subtotal = 0;
  let impuestos = 0;
  for (const linea of lineas) {
    const { base, impuesto } = computeLineTotals(linea);
    subtotal += base;
    impuestos += impuesto;
  }
  return { subtotal: round2(subtotal), impuestos: round2(impuestos), total: round2(subtotal + impuestos) };
}

function toLineItemRows(lineas: QuoteLineItemInput[]): Omit<Prisma.QuoteLineItemCreateManyInput, 'quoteId'>[] {
  return lineas.map((linea) => ({
    concepto: linea.concepto,
    cantidad: linea.cantidad,
    valorUnitario: linea.valorUnitario,
    porcentajeImpuesto: linea.porcentajeImpuesto ?? 0,
    subtotal: computeLineTotals(linea).subtotal,
  }));
}

export class QuoteService {
  async getById(id: string) {
    const quote = await quoteRepository.findById(id);
    if (!quote) throw new NotFoundError('Cotización');
    return quote;
  }

  async list(filters: { empresaId?: string; estado?: string; ticketId?: string }) {
    return quoteRepository.findMany(filters);
  }

  async findByTicketId(ticketId: string) {
    return quoteRepository.findByTicketId(ticketId);
  }

  async getPendingForApprover(userId: string) {
    return quoteRepository.findPendingForApprover(userId);
  }

  // Candidatos para el selector "elegir aprobador" al enviar una cotización
  // (ver Configuración → Usuarios, donde se otorga el permiso "quotes:approve").
  async listApprovers(empresaId: string) {
    return userRepository.findApprovers(empresaId);
  }

  async createDraft(data: CreateQuoteDTO) {
    if (data.lineas.length === 0) throw new AppError('La cotización necesita al menos una línea', 422);

    const ticket = await ticketService.getTicketById(data.ticketId);
    if (ticket.empresaId !== data.empresaId) {
      throw new AppError('El ticket no pertenece a la empresa indicada', 422);
    }

    const existingPending = await quoteRepository.findPendingByTicketId(data.ticketId);
    if (existingPending) {
      throw new AppError('Este ticket ya tiene una cotización pendiente de aprobación', 422);
    }

    const totals = computeQuoteTotals(data.lineas);

    return quoteRepository.create({
      ticket: { connect: { id: data.ticketId } },
      empresa: { connect: { id: data.empresaId } },
      razon: data.razon,
      creadoPor: { connect: { id: data.creadoPorId } },
      subtotal: totals.subtotal,
      impuestos: totals.impuestos,
      total: totals.total,
      lineas: { createMany: { data: toLineItemRows(data.lineas) } },
    });
  }

  async updateDraft(id: string, data: UpdateQuoteDTO) {
    const quote = await this.getById(id);
    if (quote.estado !== 'borrador') {
      throw new AppError('Solo se puede editar una cotización en borrador', 422);
    }

    if (data.lineas) {
      if (data.lineas.length === 0) throw new AppError('La cotización necesita al menos una línea', 422);
      const totals = computeQuoteTotals(data.lineas);
      await quoteRepository.replaceLineItems(id, toLineItemRows(data.lineas));
      await quoteRepository.update(id, {
        subtotal: totals.subtotal,
        impuestos: totals.impuestos,
        total: totals.total,
        ...(data.razon !== undefined && { razon: data.razon }),
      });
    } else if (data.razon !== undefined) {
      await quoteRepository.update(id, { razon: data.razon });
    }

    return this.getById(id);
  }

  async deleteDraft(id: string): Promise<void> {
    const quote = await this.getById(id);
    if (quote.estado !== 'borrador') {
      throw new AppError('Solo se puede eliminar una cotización en borrador', 422);
    }
    await quoteRepository.delete(id);
  }

  // Documentos de soporte (cotización del proveedor, ficha técnica, fotos)
  // — a diferencia de líneas/razón, se pueden sumar en cualquier estado: puede
  // llegar un documento nuevo después de enviar a aprobación, o incluso
  // después de aprobada, sin que eso reabra el flujo.
  async addDocuments(id: string, paths: string[]) {
    await this.getById(id); // 404 antes que Prisma tire P2025 como 500
    return quoteRepository.update(id, { documentos: { push: paths } });
  }

  // El nombre en disco es "{uuid}__{original}" (ver
  // quote-document-upload.middleware.ts) — se borra el archivo del disco
  // además de sacarlo del array, para no dejar basura acumulándose en uploads/.
  async removeDocument(id: string, filename: string) {
    const quote = await this.getById(id);
    const match = quote.documentos.find((doc) => doc.endsWith(`/${filename}`));
    if (!match) throw new NotFoundError('Documento');

    const filePath = path.join(process.cwd(), 'uploads', 'quotes', id, filename);
    await fs.promises.unlink(filePath).catch(() => {});

    return quoteRepository.update(id, { documentos: quote.documentos.filter((doc) => doc !== match) });
  }

  // Envía la cotización a aprobación: valida el aprobador, genera el token +
  // el PDF, pausa el SLA del ticket y notifica por email — si CUALQUIERA de
  // los pasos posteriores a pausar el ticket falla, se revierte todo (el
  // ticket vuelve a su estado, la cotización vuelve a borrador) en vez de
  // dejar un ticket pausado esperando una notificación que nunca llegó.
  async sendForApproval(id: string, contactoAutorizadorId: string) {
    const quote = await this.getById(id);
    if (quote.estado !== 'borrador') {
      throw new AppError('Solo se puede enviar a aprobación una cotización en borrador', 422);
    }
    if (quote.lineas.length === 0) {
      throw new AppError('La cotización necesita al menos una línea', 422);
    }

    const aprobador = await userRepository.findById(contactoAutorizadorId);
    if (
      !aprobador ||
      aprobador.rol !== 'cliente' ||
      !hasPermission(aprobador, 'quotes:approve') ||
      aprobador.empresaId !== quote.empresaId
    ) {
      throw new AppError('El usuario elegido no es un aprobador válido para esta empresa', 422);
    }

    const ticket = await ticketService.getTicketById(quote.ticketId);
    const existingPending = await quoteRepository.findPendingByTicketId(quote.ticketId);
    if (existingPending && existingPending.id !== quote.id) {
      throw new AppError('Este ticket ya tiene otra cotización pendiente de aprobación', 422);
    }

    const { token, tokenHash, expiresAt } = quoteTokenService.generate();
    const pdfPath = path.join(process.cwd(), 'uploads', 'quotes', id, `cotizacion-${id}.pdf`);

    await generateQuotePdf(
      {
        quoteId: quote.id,
        ticketTitulo: ticket.titulo,
        empresaNombre: quote.empresa.nombre,
        razon: quote.razon,
        lineas: quote.lineas.map((l) => ({
          concepto: l.concepto,
          cantidad: l.cantidad.toString(),
          valorUnitario: l.valorUnitario.toString(),
          porcentajeImpuesto: l.porcentajeImpuesto.toString(),
          subtotal: l.subtotal.toString(),
        })),
        subtotal: quote.subtotal.toString(),
        impuestos: quote.impuestos.toString(),
        total: quote.total.toString(),
        creadoPorNombre: quote.creadoPor.nombre,
      },
      pdfPath,
    );

    await quoteRepository.update(id, {
      estado: 'pendiente_aprobacion',
      contactoAutorizador: { connect: { id: contactoAutorizadorId } },
      tokenHash,
      tokenExpiresAt: expiresAt,
      pdfPath,
      ticketEstadoPrevio: ticket.estado,
    });

    await ticketService.pauseForApproval(quote.ticketId);

    const approvalUrl = `${env.frontendUrl}/quotes/approve/${token}`;
    try {
      await notificationService.queueEmailAndWait({
        to: aprobador.email,
        subject: `Aprobación requerida — ${ticket.titulo}`,
        body: `<p>Se requiere tu autorización para continuar con el ticket "<strong>${ticket.titulo}</strong>".</p><p><a href="${approvalUrl}">Ver y aprobar/rechazar la cotización</a></p><p>Este link vence el ${expiresAt.toLocaleString('es-ES')}.</p>`,
        attachments: [{ filename: 'cotizacion.pdf', path: pdfPath }],
      });
    } catch (err) {
      // El email es la única forma en que el aprobador se entera — si no se
      // pudo mandar, no tiene sentido dejar el ticket pausado esperando algo
      // que nadie sabe que existe.
      await ticketService.resumeFromApproval(quote.ticketId, ticket.estado);
      await quoteRepository.update(id, {
        estado: 'borrador',
        contactoAutorizador: { disconnect: true },
        tokenHash: null,
        tokenExpiresAt: null,
      });
      logger.error(`No se pudo notificar al aprobador de la cotización ${id}: ${(err as Error).message}`);
      throw new AppError(`No se pudo notificar al aprobador: ${(err as Error).message}`, 502);
    }

    // Complementa el email (arriba) con un aviso in-app para cuando el
    // aprobador ya está logueado en la app — ver notification.service.ts.
    await eventEmitter.emit('quote.sent', {
      quoteId: id,
      ticketId: quote.ticketId,
      ticketTitulo: ticket.titulo,
      aprobadorId: contactoAutorizadorId,
    });

    return this.getById(id);
  }

  // Cancela una solicitud pendiente por error del técnico — vuelve a
  // borrador, resume el SLA, no queda ninguna marca de "resuelto" (no fue
  // aprobada ni rechazada, simplemente no se mandó).
  async cancelPending(id: string) {
    const quote = await this.getById(id);
    if (quote.estado !== 'pendiente_aprobacion') {
      throw new AppError('Solo se puede cancelar una cotización pendiente de aprobación', 422);
    }

    await ticketService.resumeFromApproval(quote.ticketId, quote.ticketEstadoPrevio ?? 'en_progreso');
    return quoteRepository.update(id, {
      estado: 'borrador',
      contactoAutorizador: { disconnect: true },
      tokenHash: null,
      tokenExpiresAt: null,
    });
  }

  // Resuelve el token público (link de aprobación sin login) — solo por hash,
  // sin exigir que siga pendiente: quien ya tiene el token puede volver a ver
  // el resultado (aprobada/rechazada/expirada) aunque ya no pueda actuar
  // sobre ella (eso lo valida assertPendingAndNotExpired, en approve/reject).
  async resolveByToken(rawToken: string) {
    const tokenHash = quoteTokenService.hash(rawToken);
    const quote = await quoteRepository.findByTokenHash(tokenHash);
    if (!quote) throw new NotFoundError('Cotización');
    return quote;
  }

  // Chequeo de vigencia real al momento de actuar (no solo al ver) — el
  // scheduler de expiración corre cada hora, así que una cotización puede
  // seguir figurando "pendiente_aprobacion" en la base un rato después de
  // que su token ya venció; sin este chequeo, alguien podría aprobarla en esa
  // ventana igual.
  private assertPendingAndNotExpired(quote: { estado: QuoteEstado; tokenExpiresAt: Date | null }): void {
    if (quote.estado !== 'pendiente_aprobacion') {
      throw new AppError('Esta cotización ya no está pendiente de aprobación', 422);
    }
    if (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date()) {
      throw new AppError('Este link de aprobación venció', 410);
    }
  }

  async approve(id: string, input: ApproveQuoteInput) {
    const quote = await this.getById(id);
    this.assertPendingAndNotExpired(quote);

    const resueltoEn = new Date();
    const updated = await quoteRepository.update(id, {
      estado: 'aprobado',
      resueltoNombre: input.firmaNombre,
      resueltoIp: input.ip,
      resueltoUserAgent: input.userAgent,
      resueltoEn,
      firmaImagen: input.firmaImagenPath,
      ...(input.usuarioAutenticadoId && { contactoAutorizador: { connect: { id: input.usuarioAutenticadoId } } }),
    });

    await this.finalize(updated.id, updated.ticketId, updated.creadoPorId, updated.ticketEstadoPrevio, 'aprobado', {
      razon: `Aprobado por ${input.firmaNombre} (IP: ${input.ip})`,
    });

    return this.getById(id);
  }

  async reject(id: string, input: RejectQuoteInput) {
    const quote = await this.getById(id);
    this.assertPendingAndNotExpired(quote);

    const resueltoEn = new Date();
    const updated = await quoteRepository.update(id, {
      estado: 'rechazado',
      resueltoNombre: input.nombre,
      resueltoIp: input.ip,
      resueltoUserAgent: input.userAgent,
      resueltoEn,
      motivoRechazo: input.motivo,
      ...(input.usuarioAutenticadoId && { contactoAutorizador: { connect: { id: input.usuarioAutenticadoId } } }),
    });

    await this.finalize(updated.id, updated.ticketId, updated.creadoPorId, updated.ticketEstadoPrevio, 'rechazado', {
      razon: `Rechazado por ${input.nombre} (IP: ${input.ip}) — motivo: ${input.motivo}`,
    });

    return this.getById(id);
  }

  // Corrida por el scheduler (ver quote-expiration.scheduler.ts) — todo lo
  // que sigue pendiente pero ya venció su token pasa a "expirado".
  async expirePending(): Promise<number> {
    const expired = await quoteRepository.findExpiredPending(new Date());
    for (const quote of expired) {
      await quoteRepository.update(quote.id, { estado: 'expirado' });
      await this.finalize(quote.id, quote.ticketId, quote.creadoPorId, quote.ticketEstadoPrevio, 'expirado', {
        razon: 'El link de aprobación venció sin que nadie respondiera',
      });
    }
    return expired.length;
  }

  // Común a approve/reject/expirePending: resume el SLA del ticket, deja el
  // registro en el historial (atribuido al técnico que creó la cotización —
  // el aprobador externo no siempre tiene una cuenta de usuario, ver
  // ticket-history.repository.ts) y notifica al técnico.
  private async finalize(
    quoteId: string,
    ticketId: string,
    creadoPorId: string,
    ticketEstadoPrevio: TicketStatus | null,
    estado: Extract<QuoteEstado, 'aprobado' | 'rechazado' | 'expirado'>,
    history: { razon: string },
  ): Promise<void> {
    const ticket = await ticketService.resumeFromApproval(ticketId, ticketEstadoPrevio ?? 'en_progreso');

    await ticketHistoryRepository.create({
      ticketId,
      campoModificado: 'cotizacion',
      valorAnterior: 'pendiente_aprobacion',
      valorNuevo: estado,
      usuarioId: creadoPorId,
      razon: history.razon,
    });

    await eventEmitter.emit('quote.resolved', {
      quoteId,
      ticketId,
      creadoPorId,
      ticketTitulo: ticket.titulo,
      estado,
    });
  }

  // Chequeo de permisos para el canal autenticado (aprobador logueado, ver
  // public-quote vs. quote controller) — nunca deja resolver una cotización
  // ajena aunque el usuario también sea esAprobador de OTRA empresa.
  assertCanResolve(quote: { contactoAutorizadorId: string | null }, userId: string): void {
    if (quote.contactoAutorizadorId !== userId) {
      throw new ForbiddenError('No sos el aprobador designado para esta cotización');
    }
  }
}

export const quoteService = new QuoteService();
