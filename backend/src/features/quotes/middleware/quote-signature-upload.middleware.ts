import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { AppError } from '../../../shared/utils/error.handler.js';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);

// Mismo criterio que activities/middleware/signature-upload.middleware.ts.
// Siempre usa el id REAL de la cotización (req.params.id) — en la ruta
// pública (por token), resolveQuoteFromToken corre ANTES que este middleware
// y deja `req.params.id` seteado, así el archivo queda guardado en el mismo
// lugar sin importar por qué canal se subió (necesario para que la
// visualización autenticada, que sí busca por id, lo encuentre después).
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'quotes', req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `firma-${crypto.randomUUID()}${ext}`);
  },
});

// Firma dibujada en un <canvas> del frontend, exportada como PNG.
export const quoteSignatureUpload = multer({
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
