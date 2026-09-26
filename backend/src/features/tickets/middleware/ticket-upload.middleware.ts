import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

// Mismo set que quote-document-upload.middleware.ts — evidencia de cierre no
// es solo fotos, a veces es un PDF/Word/Excel (ej. informe del proveedor).
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// uploads/ vive fuera de src/ (ver .gitignore). El nombre en disco lleva el
// UUID como prefijo impredecible (nunca decide la ruta el nombre original
// solo), pero conserva el original después — a diferencia de una foto, a
// quien descarga un documento sí le importa el nombre real (mismo criterio
// que quote-document-upload.middleware.ts).
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'tickets', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const original = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 150);
    cb(null, `${crypto.randomUUID()}__${original}`);
  },
});

// Adjuntos de la documentación de cierre de un ticket (ver
// TicketService.closeTicketWithResolution) — imágenes o documentos, tamaño
// acotado, máximo 5 por cierre.
export const ticketCloseUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError('Formato no permitido — solo imágenes (JPG/PNG/WEBP), PDF, Word o Excel', 422));
      return;
    }
    cb(null, true);
  },
});
