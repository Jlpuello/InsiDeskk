import type { AuditLog } from '@prisma/client';
import { auditRepository, type AuditLogFilters, type FailedLoginFilters } from '../repositories/audit.repository.js';

// cambiosNuevos/cambiosAnteriores son el payload crudo que se le mandó a
// Prisma (ver shared/prisma/middleware/audit.middleware.ts) — para User eso
// incluye `passwordHash`. El middleware de encriptación (que sí corre antes,
// ver middleware/index.ts) nunca toca ese campo porque el hashing ya lo hizo
// AuthService/UserService antes; nunca debe salir de acá igual, ni siendo un
// hash: exponerlo habilita fuerza bruta offline contra esa contraseña.
const SENSITIVE_KEYS = new Set(['passwordHash']);

function sanitizeChanges(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeChanges);

  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    clean[key] = val;
  }
  return clean;
}

function sanitizeLog(log: AuditLog) {
  return {
    ...log,
    cambiosAnteriores: sanitizeChanges(log.cambiosAnteriores),
    cambiosNuevos: sanitizeChanges(log.cambiosNuevos),
  };
}

export class AuditService {
  async listLogs(filters: AuditLogFilters, skip: number, take: number) {
    const { rows, total } = await auditRepository.findLogs(filters, skip, take);
    return { data: rows.map(sanitizeLog), total };
  }

  async listAcciones(): Promise<string[]> {
    return auditRepository.listDistinctAcciones();
  }

  async listTablas(): Promise<string[]> {
    return auditRepository.listDistinctTablas();
  }

  async listFailedLogins(filters: FailedLoginFilters, skip: number, take: number) {
    const { rows, total } = await auditRepository.findFailedLogins(filters, skip, take);
    return { data: rows, total };
  }
}

export const auditService = new AuditService();
