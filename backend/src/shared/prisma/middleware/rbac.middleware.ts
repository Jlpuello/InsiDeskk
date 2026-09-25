import type { PrismaClient } from '@prisma/client';
import { getCurrentUser } from '../../utils/context.js';

// Filtra automáticamente por empresaId según el rol del usuario actual (leído
// del AsyncLocalStorage que rellena verifyJWT, ver shared/utils/context.ts).
// Nota: por diseño, 'admin' no se filtra — tiene visibilidad global.
export function setupRBACMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
    const user = getCurrentUser();

    if (!user || !user.empresaId) {
      return next(params);
    }

    const isReadOnMultiTenantModel =
      (params.model === 'Ticket' || params.model === 'Device') &&
      (params.action === 'findUnique' || params.action === 'findMany' || params.action === 'findFirst');

    // CLIENTE y TÉCNICO: solo ven datos de su propia empresa.
    if ((user.rol === 'cliente' || user.rol === 'tecnico') && isReadOnMultiTenantModel) {
      params.args = params.args ?? {};
      params.args.where = { ...params.args.where, empresaId: user.empresaId };
    }

    // CLIENTE: además, solo ve notas de tickets de su propia empresa.
    if (
      user.rol === 'cliente' &&
      params.model === 'Note' &&
      (params.action === 'findUnique' || params.action === 'findMany' || params.action === 'findFirst')
    ) {
      params.args = params.args ?? {};
      params.args.where = { ...params.args.where, ticket: { empresaId: user.empresaId } };
    }

    return next(params);
  });
}
