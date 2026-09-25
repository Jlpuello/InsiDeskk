import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// uploads/ vive fuera de src/ (ver .gitignore) — nombres de archivo son un
// UUID + extensión, nunca el nombre original, para no depender de que el
// cliente mande algo sanitizado ni pisar archivos entre sí.
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'tickets', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

// Adjuntos de la documentación de cierre de un ticket (ver
// TicketService.closeTicketWithResolution) — solo imágenes, tamaño acotado,
// máximo 5 por cierre.
export const ticketCloseUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError('Solo se permiten imágenes JPG, PNG o WEBP', 422));
      return;
    }
    cb(null, true);
  },
});
