import type { NextFunction, Request, Response } from 'express';
import { jwtService } from '../auth/jwt.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';
import { runWithContext } from '../utils/context.js';
import { ACCESS_COOKIE, isCsrfValid } from '../auth/session-cookies.js';
import { tokenVersionService } from '../auth/token-version.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Verifica el JWT y publica el usuario actual (id, rol, empresaId) + IP/UA en el
// AsyncLocalStorage de shared/utils/context.ts, para que los middlewares de
// Prisma (audit, RBAC) puedan leerlos sin que cada query reciba el `Request`.
// Envuelta en asyncHandler al exportar (ver abajo): Express 4 no reenvía
// rechazos de promesas al errorHandler solo, y esto ahora hace lookups
// async (cache/DB) para el chequeo de tokenVersion.
async function verifyJWTImpl(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  const bearer = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const cookieToken = req.cookies?.[ACCESS_COOKIE] as string | undefined;

  // Bearer tiene prioridad (clientes no-browser, tests) y no necesita CSRF: el
  // navegador no agrega un header Authorization por su cuenta. La cookie sí
  // viaja sola en cualquier request cross-site, por eso exige el double-submit
  // en los métodos que modifican estado.
  const token = bearer ?? cookieToken;
  if (!token) {
    throw new UnauthorizedError('Token no proporcionado');
  }
  if (!bearer && !SAFE_METHODS.has(req.method) && !isCsrfValid(req)) {
    throw new ForbiddenError('Falta o es inválido el token CSRF');
  }

  let payload;
  try {
    payload = jwtService.verifyToken(token);
  } catch {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  // Los tokens de propósito especial (ej. "contraseña OK, falta 2FA" — ver
  // generateTwoFactorPendingToken) nunca traen rol/tokenVersion — sin este
  // chequeo, uno de esos igual pasaría por acá y quedaría autenticado para
  // cualquier ruta que no chequee un rol específico (ej. las de /api/account,
  // abiertas a cualquier usuario autenticado).
  if (!payload.rol || typeof payload.tokenVersion !== 'number') {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  const currentVersion = await tokenVersionService.getCurrent(payload.id);
  if (currentVersion === null || payload.tokenVersion !== currentVersion) {
    throw new UnauthorizedError('Token inválido o expirado');
  }

  req.user = payload;

  runWithContext(
    {
      userId: payload.id,
      userRole: payload.rol as 'admin' | 'tecnico' | 'cliente',
      empresaId: payload.empresaId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    next,
  );
}

export const verifyJWT = asyncHandler(verifyJWTImpl);

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowedRoles.includes(req.user.rol)) {
      throw new ForbiddenError('No tienes permisos para esta acción');
    }
    next();
  };
}
