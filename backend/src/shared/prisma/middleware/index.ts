import type { PrismaClient } from '@prisma/client';
import { setupEncryptionMiddleware } from './encryption.middleware.js';
import { setupAuditMiddleware } from './audit.middleware.js';
import { setupRBACMiddleware } from './rbac.middleware.js';

export function setupPrismaMiddleware(prisma: PrismaClient): PrismaClient {
  // El orden importa: encriptar primero, luego auditar (para loguear el
  // cambio ya "canonicalizado"), y RBAC al final justo antes de que la query
  // llegue a la base de datos.
  setupEncryptionMiddleware(prisma);
  setupAuditMiddleware(prisma);
  setupRBACMiddleware(prisma);

  return prisma;
}
