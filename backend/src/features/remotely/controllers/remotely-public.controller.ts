import type { Request, Response } from 'express';
import Joi from 'joi';
import { deviceRepository } from '../../devices/index.js';
import { remotelyService } from '../services/remotely.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

// Sin auth a propósito: lo llama el propio equipo recién instalado por el
// .bat generado en agent-deploy.util.ts, al terminar
// harden-agent.script.ts — ese equipo no tiene cuenta ni JWT, igual que
// cuando pega directo contra la API pública de Remotely (ver el comentario
// en agent-deploy.util.ts sobre /api/ClientDownloads). El único efecto
// posible de un abuso de este endpoint es marcar como "endurecido" un
// dispositivo YA EXISTENTE de una empresa (empresaId+hostname deben
// matchear un Device real) para fines de visualización en la lista de
// Dispositivos — no otorga acceso a nada ni cambia ningún otro dato.
const hardenReportSchema = Joi.object({
  empresaId: Joi.string().uuid().required(),
  hostname: Joi.string().min(1).max(255).required(),
  success: Joi.boolean().required(),
});

export const RemotelyPublicController = {
  async hardenReport(req: Request, res: Response): Promise<void> {
    const { error, value } = hardenReportSchema.validate(req.body);
    if (error) throw new AppError(error.message, 400);

    // Solo se registra el caso de éxito — si falló, el estado por default
    // (agentHardenedAt = null) ya representa "no endurecido" correctamente.
    if (value.success) {
      await deviceRepository.markHardened(value.empresaId, value.hostname, new Date());
    }

    res.status(204).send();
  },

  // Redirect al ejecutable portátil real de Remotely (sin auth también del
  // lado de Remotely, ver buildPortableDownloadUrl) — el link que un staff
  // manda por chat apunta acá (nuestro dominio) en vez de al servidor de
  // Remotely directo, mismo criterio de indirección que el resto de los
  // links públicos de este archivo. No requiere token: a diferencia del
  // instalador que reemplaza (que instalaba un servicio permanente y por eso
  // se quitó de este flujo por seguridad), este ejecutable no instala nada —
  // es el mismo archivo público que Remotely ya serviría sin auth si se le
  // pegara directo.
  async portableDownload(_req: Request, res: Response): Promise<void> {
    const url = await remotelyService.buildPortableDownloadUrl();
    res.redirect(302, url);
  },
};
