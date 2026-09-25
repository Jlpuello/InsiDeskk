import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);

// Mismo criterio que ticket-upload.middleware.ts: nombre de archivo siempre
// generado (nunca el original), uploads/ fuera de src/.
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'actas', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `firma-${crypto.randomUUID()}${ext}`);
  },
});

// Firma dibujada en un <canvas> del frontend, exportada como PNG — un solo
// archivo, tamaño chico (es un dibujo simple, no una foto).
export const signatureUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError('La firma debe ser una imagen PNG o JPG', 422));
      return;
    }
    cb(null, true);
  },
});
