import type { NextFunction, Request, Response } from 'express';
import { jwtService } from '../auth/jwt.service.js';
import { UnauthorizedError, ForbiddenError } from '../utils/AppError.js';
import { runWithContext } from '../utils/context.js';

// Verifica el JWT y publica el usuario actual (id, rol, empresaId) + IP/UA en el
// AsyncLocalStorage de shared/utils/context.ts, para que los middlewares de
// Prisma (audit, RBAC) puedan leerlos sin que cada query reciba el `Request`.
export function verifyJWT(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token no proporcionado');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = jwtService.verifyToken(token);
  } catch {
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

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError();
    if (!allowedRoles.includes(req.user.rol)) {
      throw new ForbiddenError('No tienes permisos para esta acción');
    }
    next();
  };
}
