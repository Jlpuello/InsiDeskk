import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Mismo criterio que ticket-upload.middleware.ts: nombre de archivo siempre
// generado (nunca el original), uploads/ fuera de src/.
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'activities', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

// Fotos de evidencia al completar una actividad (ver
// ActivityController.complete) — mismos límites que el cierre de ticket.
export const completionUpload = multer({
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
