import type { Request, Response } from 'express';
import { platformSettingsService } from '../services/platform-settings.service.js';

export const SeoPublicController = {
  // Sin autenticación — lo consume useSeoMeta en las páginas públicas
  // (home, /soporte, /reportar) para setear <title>/<meta name="description">
  // en tiempo de carga. Nada acá es secreto.
  async get(_req: Request, res: Response): Promise<void> {
    const seo = await platformSettingsService.getSeoPublic();
    res.status(200).json({ data: seo });
  },
};
