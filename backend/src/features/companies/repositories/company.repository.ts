import { Prisma, type Company } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { nitMatches } from '../../../shared/utils/nit.util.js';

export class CompanyRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({ data });
  }

  async findById(id: string) {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async findMany() {
    return this.prisma.company.findMany({ orderBy: { nombre: 'asc' } });
  }

  async update(id: string, data: Prisma.CompanyUpdateInput) {
    return this.prisma.company.update({ where: { id }, data });
  }

  // Usado por el poller de Remotely (remotely.service.ts) para resolver, por
  // cada dispositivo sincronizado, a qué empresa pertenece según su grupo.
  async findAllMappedToRemotelyGroup(): Promise<Pick<Company, 'id' | 'remotelyGroupId'>[]> {
    return this.prisma.company.findMany({
      where: { remotelyGroupId: { not: null } },
      select: { id: true, remotelyGroupId: true },
    });
  }

  // Usado por el formulario público de tickets/chat (sin login) para
  // identificar la empresa por NIT. Primero un match exacto (nit es
  // @unique, usa el índice); si no aparece, cae a nitMatches en memoria —
  // cubre el caso real de un NIT guardado como "900123456-7" (con el dígito
  // de verificación) contra alguien que tipeó solo "900123456".
  async findByNit(nit: string): Promise<Pick<Company, 'id' | 'nombre'> | null> {
    const exact = await this.prisma.company.findFirst({
      where: { nit, activo: true },
      select: { id: true, nombre: true },
    });
    if (exact) return exact;

    const candidates = await this.prisma.company.findMany({
      where: { activo: true, nit: { not: null } },
      select: { id: true, nombre: true, nit: true },
    });
    const match = candidates.find((c) => c.nit && nitMatches(c.nit, nit));
    return match ? { id: match.id, nombre: match.nombre } : null;
  }

  // Alta mínima desde la landing pública cuando el NIT no matcheó ninguna
  // empresa existente (ver companyService.resolveOrProvisionByNit) —
  // verificado:false para que quede marcada como pendiente de revisión.
  async createUnverified(nit: string, nombre: string): Promise<Pick<Company, 'id' | 'nombre'>> {
    return this.prisma.company.create({
      data: { nit, nombre, verificado: false },
      select: { id: true, nombre: true },
    });
  }

  // Usado por companyService.resolveOrProvisionByPhone — telefono es texto
  // libre (no @unique, no indexado), así que el match por número se hace en
  // memoria sobre este listado en vez de un WHERE exacto en la base.
  async findManyWithPhone(): Promise<Pick<Company, 'id' | 'nombre' | 'telefono'>[]> {
    return this.prisma.company.findMany({
      where: { telefono: { not: null }, activo: true },
      select: { id: true, nombre: true, telefono: true },
    });
  }

  // Alta mínima desde un mensaje de WhatsApp de un número sin empresa
  // asociada — mismo criterio que createUnverified, pero por telefono en vez
  // de nit (WhatsApp no trae NIT).
  async createUnverifiedByPhone(phone: string, nombre: string): Promise<Pick<Company, 'id' | 'nombre'>> {
    return this.prisma.company.create({
      data: { telefono: phone, nombre, verificado: false },
      select: { id: true, nombre: true },
    });
  }
}

export const companyRepository = new CompanyRepository();
