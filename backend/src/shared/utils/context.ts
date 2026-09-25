import { AsyncLocalStorage } from 'node:async_hooks';

// Los middlewares de Prisma (audit, RBAC) no reciben el `Request` de Express,
// así que necesitan otra forma de saber quién hizo la petición actual. Un
// middleware de Express (contextMiddleware, más abajo) guarda estos datos en
// un AsyncLocalStorage antes de llamar next(); cualquier código que corra
// dentro de esa misma cadena de promesas (incluyendo las queries de Prisma)
// puede leerlos de vuelta sin necesidad de pasarlos como parámetro.
export interface RequestContext {
  userId?: string;
  userRole?: 'admin' | 'tecnico' | 'cliente';
  empresaId?: string;
  ip?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getCurrentUserId(): string | undefined {
  return storage.getStore()?.userId;
}

export function getCurrentUser(): { rol: string; empresaId?: string } | undefined {
  const ctx = storage.getStore();
  if (!ctx?.userId) return undefined;
  return { rol: ctx.userRole ?? 'cliente', empresaId: ctx.empresaId };
}

export function getClientIP(): string | undefined {
  return storage.getStore()?.ip;
}

export function getUserAgent(): string | undefined {
  return storage.getStore()?.userAgent;
}
