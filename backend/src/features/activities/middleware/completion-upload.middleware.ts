import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

// Mismo set que ticket-upload.middleware.ts / quote-document-upload.middleware.ts.
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

// Mismo criterio que ticket-upload.middleware.ts: uploads/ fuera de src/, el
// nombre en disco conserva el original (documentos, no solo fotos, se
// benefician de eso al descargar).
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'activities', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const original = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 150);
    cb(null, `${crypto.randomUUID()}__${original}`);
  },
});

// Evidencia al completar una actividad (ver ActivityController.complete) —
// imágenes o documentos, mismos límites que el cierre de ticket.
export const completionUpload = multer({
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
