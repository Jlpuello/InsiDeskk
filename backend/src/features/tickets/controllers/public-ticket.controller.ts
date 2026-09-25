import type { Request, Response } from 'express';
import Joi from 'joi';
import { ticketService } from '../services/ticket.service.js';
import { ticketCategoryService } from '../services/ticket-category.service.js';
import { companyService } from '../../companies/services/company.service.js';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import { verifyTurnstileToken } from '../../../shared/security/turnstile.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { sanitizeNestedDevice } from '../../../shared/utils/mask.js';
import { NIT_FORMAT } from '../../../shared/utils/nit.util.js';

const nitPattern = Joi.string()
  .pattern(NIT_FORMAT)
  .messages({ 'string.pattern.base': 'El NIT debe tener solo números (5 a 15 dígitos)' });

const verifyCompanySchema = Joi.object({
  nit: nitPattern.required(),
});

// Sin prioridad/criticidad ni asignación manual acá a propósito: quien
// reporta desde afuera, sin cuenta, no debería poder autodeclararse
// "crítico" para saltar la cola — la severidad la sigue fijando la
// categoría/subcategoría (igual que en el flujo interno) o queda en 'media'.
//
// nit deja de ser obligatorio a nivel de schema: sinNit:true (soporte a un
// particular, sin empresa) es la otra rama válida — la exclusión mutua y los
// requisitos de turnstileToken se validan a mano en create() de abajo,
// porque dependen de datos que hay que consultar (si el NIT existe o no),
// algo que Joi no puede resolver por sí solo con un .when().
//
// nombreEmpresa es opcional y solo se usa cuando el NIT no matcheó ninguna
// Company existente (ver companyService.resolveOrProvisionByNit).
const publicCreateTicketSchema = Joi.object({
  sinNit: Joi.boolean(),
  nit: nitPattern,
  nombreEmpresa: Joi.string().min(2).max(150).empty(''),
  // Token del widget de Cloudflare Turnstile — requerido solo en los
  // caminos que autoprovisionan una empresa o usan la empresa por defecto
  // (ver create() y turnstile.service.ts). El camino de NIT ya registrado no
  // lo necesita.
  turnstileToken: Joi.string().min(1),
  titulo: Joi.string().min(3).max(255).required(),
  descripcion: Joi.string().min(3),
  categoriaId: Joi.string().uuid().empty(''),
  subcategoriaId: Joi.string().uuid().empty(''),
  reporterNombre: Joi.string().min(2).max(150).required(),
  reporterEmail: Joi.string().email({ tlds: false }).empty(''),
  reporterTelefono: Joi.string().min(5).max(30).empty(''),
})
  .or('reporterEmail', 'reporterTelefono')
  .messages({ 'object.missing': 'Dejá al menos un dato de contacto: email o teléfono' });

// Resuelve a qué empresa queda el ticket, y exige Turnstile en los dos
// caminos que autoprovisionan/usan una empresa compartida — el único camino
// sin captcha es un NIT que YA matchea una empresa real.
async function resolveEmpresaIdForPublicTicket(
  value: { sinNit?: boolean; nit?: string; nombreEmpresa?: string; turnstileToken?: string },
  requestIp: string | undefined,
): Promise<string> {
  if (value.sinNit) {
    if (value.nit) throw new AppError('No se puede indicar un NIT y "sin NIT" al mismo tiempo', 422);

    const verified = await verifyTurnstileToken(value.turnstileToken, requestIp);
    if (!verified) throw new AppError('No se pudo verificar que sos una persona real — intentá de nuevo', 422);

    const defaultCompanyId = await platformSettingsService.getDefaultCompanyId();
    if (!defaultCompanyId) {
      throw new AppError('El soporte a clientes sin NIT todavía no está habilitado — contactanos por otro medio', 422);
    }
    return defaultCompanyId;
  }

  if (!value.nit) throw new AppError('Falta el NIT (o indicá que no tenés uno)', 422);

  const existing = await companyService.findByNitForPublicVerification(value.nit);
  if (!existing) {
    if (!value.nombreEmpresa) throw new AppError('Falta el nombre de tu empresa', 422);

    const verified = await verifyTurnstileToken(value.turnstileToken, requestIp);
    if (!verified) throw new AppError('No se pudo verificar que sos una persona real — intentá de nuevo', 422);
  }

  const company = await companyService.resolveOrProvisionByNit(value.nit, value.nombreEmpresa);
  return company.id;
}

export const PublicTicketController = {
  // Solo nombre/id, activas — sin prioridadDefault/criticidadDefault/
  // nivelRequerido (configuración interna de ruteo, sin motivo para
  // exponerla sin autenticación).
  async listCategories(_req: Request, res: Response): Promise<void> {
    const categories = await ticketCategoryService.list();
    const data = categories
      .filter((c) => c.activo)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        subcategorias: c.subcategorias.filter((s) => s.activo).map((s) => ({ id: s.id, nombre: s.nombre })),
      }));
    res.status(200).json({ data });
  },

  // Confirma existencia + nombre de la empresa por NIT — nada más. No expone
  // el resto de los datos de Company (dirección, contrato, etc.) porque este
  // endpoint no tiene autenticación. Ya NO tira 404 si no la encuentra: el
  // frontend usa `encontrada` para decidir si pide el nombre de la empresa
  // antes de seguir (ver create() — cualquier NIT puede reportar un ticket,
  // con o sin contrato existente).
  async verifyCompany(req: Request, res: Response): Promise<void> {
    const { error, value } = verifyCompanySchema.validate(req.query);
    if (error) throw new AppError(error.message, 422);

    const company = await companyService.findByNitForPublicVerification(value.nit);
    res.status(200).json({ data: { encontrada: Boolean(company), company } });
  },

  async create(req: Request, res: Response): Promise<void> {
    const { error, value } = publicCreateTicketSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const empresaId = await resolveEmpresaIdForPublicTicket(value, req.ip);

    const ticket = await ticketService.createTicket({
      titulo: value.titulo,
      descripcion: value.descripcion,
      empresaId,
      categoriaId: value.categoriaId,
      subcategoriaId: value.subcategoriaId,
      reporterNombre: value.reporterNombre,
      reporterEmail: value.reporterEmail,
      reporterTelefono: value.reporterTelefono,
    });
    res.status(201).json({ data: sanitizeNestedDevice(ticket) });
  },
};
