import type { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import { getClientIP, getCurrentUserId, getUserAgent } from '../../utils/context.js';

const AUDITED_ACTIONS = new Set(['create', 'update', 'delete']);

export function setupAuditMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    // AuditLog y FailedLoginAttempt no se auditan a sí mismos (evita recursión infinita).
    if (params.model === 'AuditLog' || params.model === 'FailedLoginAttempt') {
      return next(params);
    }

    try {
      const result = await next(params);

      if (AUDITED_ACTIONS.has(params.action) && result?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              usuarioId: getCurrentUserId(),
              accion: params.action.toUpperCase(),
              tabla: params.model ?? '',
              registroId: result.id,
              cambiosNuevos: params.args.data ?? undefined,
              ipAddress: getClientIP(),
              userAgent: getUserAgent(),
              resultado: 'success',
            },
          });
        } catch (auditError) {
          logger.error(`No se pudo crear el audit log: ${(auditError as Error).message}`);
        }
      }

      return result;
    } catch (error) {
      if (AUDITED_ACTIONS.has(params.action)) {
        try {
          await prisma.auditLog.create({
            data: {
              usuarioId: getCurrentUserId(),
              accion: params.action.toUpperCase(),
              tabla: params.model ?? '',
              ipAddress: getClientIP(),
              userAgent: getUserAgent(),
              resultado: 'failure',
              errorMessage: (error as Error).message,
            },
          });
        } catch (auditError) {
          logger.error(`No se pudo crear el audit log de fallo: ${(auditError as Error).message}`);
        }
      }

      throw error;
    }
  });
}
