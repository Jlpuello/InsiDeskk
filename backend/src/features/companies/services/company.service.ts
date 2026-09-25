import { Prisma, type Company } from '@prisma/client';
import { companyRepository } from '../repositories/company.repository.js';
import { NotFoundError } from '../../../shared/utils/error.handler.js';
import { recordCriticalAction } from '../../../shared/security/critical-action.service.js';
import { resolveEmpresaId, assertOwnCompanyOrAdmin } from '../../../shared/security/tenant-scope.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { CacheKeys } from '../../../shared/cache/cache-keys.js';
import type { CreateCompanyInput, UpdateCompanyInput } from '../types/company.types.js';

// Solo dígitos — Company.telefono es texto libre cargado a mano (puede traer
// espacios, guiones, "+57", etc.), mientras que el número que manda Meta en
// un mensaje de WhatsApp viene limpio. Comparar solo dígitos evita que un
// formato distinto genere una empresa duplicada para el mismo número.
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export class CompanyService {
  // A diferencia de Ticket/Device, Company no pasa por el middleware RBAC de
  // Prisma (que solo filtra esos dos modelos) ni tenía chequeo manual propio
  // — GET quedaba abierto a cualquier rol autenticado sin filtrar por
  // empresa. admin sigue viendo todas; cliente/tecnico solo la suya.
  async list(): Promise<Company[]> {
    const empresaId = resolveEmpresaId();
    if (!empresaId) return companyRepository.findMany();
    const own = await companyRepository.findById(empresaId);
    return own ? [own] : [];
  }

  async getById(id: string): Promise<Company> {
    const company = await companyRepository.findById(id);
    if (!company) throw new NotFoundError('Empresa');
    assertOwnCompanyOrAdmin(company.id);
    return company;
  }

  // Para el formulario público de tickets — solo confirma existencia +
  // nombre, nunca el resto de los datos de la empresa (dirección, contrato,
  // etc.), que no tienen por qué quedar expuestos sin autenticación.
  async findByNitForPublicVerification(nit: string): Promise<{ id: string; nombre: string } | null> {
    return companyRepository.findByNit(nit);
  }

  // Usado por la creación real de tickets/conversaciones públicas (a
  // diferencia de findByNitForPublicVerification, que solo informa si existe
  // — acá si no existe SE CREA). Deja abierta la landing a empresas sin
  // contrato u no registradas: nace con verificado:false para que el equipo
  // la revise/complete/fusione desde CompaniesPage, en vez de rechazar el
  // ticket/conversación con un 404 como antes.
  async resolveOrProvisionByNit(nit: string, nombrePropuesto?: string): Promise<{ id: string; nombre: string }> {
    const existing = await companyRepository.findByNit(nit);
    if (existing) return existing;

    const nombre = nombrePropuesto?.trim() || `Empresa ${nit}`;
    try {
      return await companyRepository.createUnverified(nit, nombre);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Carrera (dos submits casi simultáneos con el mismo NIT) — a esta
        // altura ya existe una fila válida, se reintenta en vez de fallar.
        const retried = await companyRepository.findByNit(nit);
        if (retried) return retried;
        // Chocó por `nombre` (lo tenía tomado una empresa NO relacionada,
        // Company.nombre es @unique) — se desambigua con el NIT, que sí lo es.
        return companyRepository.createUnverified(nit, `${nombre} (NIT ${nit})`);
      }
      throw err;
    }
  }

  // Usado por conversationService.receiveWhatsappMessage cuando llega un
  // mensaje de un número sin conversación abierta todavía — mismo criterio
  // que resolveOrProvisionByNit (nunca bloquea, autoprovisiona verificado:false).
  async resolveOrProvisionByPhone(phone: string, nombreContacto?: string): Promise<{ id: string; nombre: string }> {
    const normalized = normalizePhone(phone);
    const findMatch = async () => {
      const candidates = await companyRepository.findManyWithPhone();
      return candidates.find((c) => c.telefono && normalizePhone(c.telefono) === normalized) ?? null;
    };

    const existing = await findMatch();
    if (existing) return existing;

    const nombre = nombreContacto?.trim() || `WhatsApp ${phone}`;
    try {
      return await companyRepository.createUnverifiedByPhone(phone, nombre);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        // Carrera (dos mensajes casi simultáneos del mismo número nuevo) o
        // `nombre` ya tomado por una empresa no relacionada — mismo criterio
        // que resolveOrProvisionByNit.
        const retried = await findMatch();
        if (retried) return retried;
        return companyRepository.createUnverifiedByPhone(phone, `${nombre} (${phone})`);
      }
      throw err;
    }
  }

  async create(input: CreateCompanyInput): Promise<Company> {
    const company = await companyRepository.create(input);
    await this.invalidateGroupMapIfNeeded(input);
    return company;
  }

  async update(id: string, input: UpdateCompanyInput): Promise<Company> {
    await this.getById(id); // 404 antes que Prisma tire P2025 como 500
    const company = await companyRepository.update(id, input);
    await this.invalidateGroupMapIfNeeded(input);
    return company;
  }

  // El poller de Remotely (remotely.service.ts) cachea el mapeo grupo→empresa
  // 5 min — sin esto, cambiar el mapeo desde la UI tardaría hasta 5 min en
  // reflejarse en la próxima alta/reasignación automática de un equipo.
  private async invalidateGroupMapIfNeeded(input: CreateCompanyInput | UpdateCompanyInput): Promise<void> {
    if ('remotelyGroupId' in input) {
      await cacheService.delete(CacheKeys.companiesByRemotelyGroup);
    }
  }

  // "Eliminar" en la UI es desactivar, no un DELETE real: Device y Ticket
  // tienen onDelete: Cascade hacia Company (ver schema.prisma) — un borrado
  // real de una empresa con equipos/tickets los borraría a todos con ella.
  // activo:false la saca de las listas activas sin ese riesgo. Acción
  // crítica igual: exige motivo y queda auditado con detalle.
  async deactivate(id: string, motivo: string): Promise<Company> {
    await this.getById(id);
    const company = await companyRepository.update(id, { activo: false });
    await recordCriticalAction({ accion: 'COMPANY_DEACTIVATE', tabla: 'Company', registroId: id, motivo });
    return company;
  }
}

export const companyService = new CompanyService();
