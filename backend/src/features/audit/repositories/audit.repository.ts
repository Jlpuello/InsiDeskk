import type { Prisma } from '@prisma/client';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { safeUserSelect } from '../../../shared/prisma/safe-select.js';

export interface AuditLogFilters {
  usuarioId?: string;
  accion?: string;
  tabla?: string;
  resultado?: string;
  // Filtra a solo las acciones marcadas como críticas (ver
  // shared/security/critical-action.service.ts) — son las únicas con
  // `motivo` cargado, el resto es el auto-audit genérico de cualquier
  // create/update/delete.
  soloConMotivo?: boolean;
  desde?: Date;
  hasta?: Date;
}

export interface FailedLoginFilters {
  email?: string;
  ipAddress?: string;
  desde?: Date;
  hasta?: Date;
}

function dateRange(desde?: Date, hasta?: Date): Prisma.DateTimeFilter | undefined {
  if (!desde && !hasta) return undefined;
  return { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) };
}

function buildAuditWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const createdAt = dateRange(filters.desde, filters.hasta);
  return {
    ...(filters.usuarioId && { usuarioId: filters.usuarioId }),
    ...(filters.accion && { accion: filters.accion }),
    ...(filters.tabla && { tabla: filters.tabla }),
    ...(filters.resultado && { resultado: filters.resultado }),
    ...(filters.soloConMotivo && { motivo: { not: null } }),
    ...(createdAt && { createdAt }),
  };
}

export class AuditRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async findLogs(filters: AuditLogFilters, skip: number, take: number) {
    const where = buildAuditWhere(filters);
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { usuario: { select: safeUserSelect } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { rows, total };
  }

  // Alimentan los <select> de filtro del lado del frontend — evita hardcodear
  // ahí una lista que se desincroniza apenas se agrega una CriticalAction nueva.
  async listDistinctAcciones(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({ distinct: ['accion'], select: { accion: true } });
    return rows.map((r) => r.accion).sort();
  }

  async listDistinctTablas(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({ distinct: ['tabla'], select: { tabla: true } });
    return rows.map((r) => r.tabla).sort();
  }

  async findFailedLogins(filters: FailedLoginFilters, skip: number, take: number) {
    const where: Prisma.FailedLoginAttemptWhereInput = {
      ...(filters.email && { email: { contains: filters.email, mode: 'insensitive' } }),
      ...(filters.ipAddress && { ipAddress: filters.ipAddress }),
      ...(dateRange(filters.desde, filters.hasta) && { createdAt: dateRange(filters.desde, filters.hasta) }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.failedLoginAttempt.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.failedLoginAttempt.count({ where }),
    ]);
    return { rows, total };
  }
}

export const auditRepository = new AuditRepository();
