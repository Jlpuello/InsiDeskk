import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// Documentos de soporte (cotización del proveedor, ficha técnica, fotos del
// repuesto) — a diferencia de la firma, acá SÍ importa el nombre original
// para quien lo descarga después, así que se guarda como prefijo del nombre
// en disco ("{uuid}__{original saneado}") en vez de descartarlo. El uuid
// como prefijo sigue siendo lo que hace impredecible el nombre real en
// disco — el nombre original nunca decide la ruta por sí solo.
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'quotes', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const original = file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 150);
    cb(null, `${crypto.randomUUID()}__${original}`);
  },
});

export const quoteDocumentUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new AppError('Formato no permitido — solo PDF, Word, Excel o imágenes (PNG/JPG/WEBP)', 422));
      return;
    }
    cb(null, true);
  },
});
