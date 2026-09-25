import { Prisma, type User, type UserRole } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';

export class UserRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
      include: { empresa: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { empresa: true },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { empresa: true },
    });
  }

  async findMany(where?: Prisma.UserWhereInput, skip?: number, take?: number) {
    return this.prisma.user.findMany({
      where,
      skip,
      take,
      include: { empresa: true },
    });
  }

  // Para alertas de plataforma que le tienen que llegar a todo el equipo
  // admin (ver remotely-package-integrity.scheduler.ts) — no a un usuario
  // puntual, así que no encaja en el flujo normal de notificaciones por evento.
  async findAdmins(): Promise<User[]> {
    return this.prisma.user.findMany({ where: { rol: 'admin', activo: true } });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { empresa: true },
    });
  }

  async delete(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async findByCompanyId(empresaId: string) {
    return this.prisma.user.findMany({
      where: { empresaId },
      include: { empresa: true },
    });
  }

  async findByRole(rol: UserRole) {
    return this.prisma.user.findMany({
      where: { rol },
    });
  }

  // Candidatos para auto-asignación por nivel (ver
  // TicketService.pickLeastLoadedTechnician) — solo técnicos activos de esa
  // empresa y ese nivel exacto.
  async findByNivelActivo(empresaId: string, nivel: number) {
    return this.prisma.user.findMany({
      where: { empresaId, rol: 'tecnico', nivel, activo: true },
    });
  }

  // Candidatos elegibles como aprobador de una cotización (ver
  // QuoteService.sendForApproval) — solo clientes activos de esa empresa con
  // el permiso "quotes:approve" (ver Configuración → Usuarios y
  // shared/security/permissions.ts).
  async findApprovers(empresaId: string) {
    return this.prisma.user.findMany({
      where: { empresaId, rol: 'cliente', activo: true, permisos: { has: 'quotes:approve' } },
    });
  }
}

export const userRepository = new UserRepository();
