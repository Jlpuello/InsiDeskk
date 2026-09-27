import type { Request, Response } from 'express';
import { platformSettingsService } from '../services/platform-settings.service.js';

export const OrganizationPublicController = {
  // Sin autenticación — la landing pública (home / /soporte) lo usa para
  // mostrar razón social/NIT/teléfono/email de la empresa que opera esta
  // instancia. Nada acá es secreto (ver OrganizationPublicInfo).
  async get(_req: Request, res: Response): Promise<void> {
    const info = await platformSettingsService.getOrganizationPublic();
    res.status(200).json({ data: info });
  },
};
