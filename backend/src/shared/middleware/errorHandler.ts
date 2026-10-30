import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }

  // Límites de multer (tamaño/cantidad de archivos) — ver ticket-upload.middleware.ts.
  if (err instanceof MulterError) {
    res.status(422).json({ error: `Error subiendo archivo: ${err.message}` });
    return;
  }

  // Red de seguridad: si algún service olvida chequear existencia antes de un
  // update/delete, Prisma tira estos errores en vez de un 404/409 — se
  // traducen acá para no exponer un 500 genérico por un simple "no encontrado".
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con ese valor único' });
      return;
    }
    // Un borrado físico chocó con un registro relacionado protegido
    // (onDelete: Restrict) — p.ej. historial de sesiones/scripts de un
    // Device. Los flujos que ya conocen este caso lo manejan antes (ver
    // DeviceService.remove); esto es la red de seguridad para el resto.
    if (err.code === 'P2003') {
      res.status(409).json({ error: 'No se puede eliminar: tiene registros relacionados que dependen de él' });
      return;
    }
  }

  logger.error(err.message, { stack: err.stack, path: req.originalUrl });
  res.status(500).json({ error: 'Error interno del servidor' });
}
