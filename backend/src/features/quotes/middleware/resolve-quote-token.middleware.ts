import type { NextFunction, Request, Response } from 'express';
import { quoteService } from '../services/quote.service.js';

// Corre ANTES de quoteSignatureUpload en las rutas públicas (por token) que
// suben un archivo — resuelve el token a la cotización real y deja
// `req.params.id` seteado con su id de base de datos, para que el upload (y
// todo lo demás río abajo) trabaje igual que en el canal autenticado, sin
// duplicar lógica de guardado por dos convenciones de carpeta distintas.
export async function resolveQuoteFromToken(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const quote = await quoteService.resolveByToken(req.params.token);
  req.params.id = quote.id;
  next();
}
