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

  // Link temporal (24h, ver remotelyService.createInstallerLink) que un
  // staff manda por chat a un contacto externo para que se baje el .bat de
  // SU empresa sin necesitar cuenta — mismo criterio de "sin auth" que
  // hardenReport arriba, acotado por el token en vez de por sesión.
  async agentInstaller(req: Request, res: Response): Promise<void> {
    const companyId = await remotelyService.resolveInstallerToken(req.params.token);
    if (!companyId) {
      res.status(404).type('text/plain').send('Este link venció o no es válido — pedile uno nuevo al técnico.');
      return;
    }

    const info = await remotelyService.buildAgentScriptInfo(companyId, { requireGroup: false });
    // Content-Disposition no tolera bien acentos/espacios/comillas en el
    // nombre de archivo — se sanitiza, el nombre "lindo" ya está dentro del
    // propio .bat si hiciera falta mostrarlo.
    const safeName = info.companyName.replace(/[^a-zA-Z0-9-]+/g, '-');
    res
      .status(200)
      .type('application/octet-stream')
      .set('Content-Disposition', `attachment; filename="instalar-agente-${safeName}.bat"`)
      .send(info.windows.batContent);
  },
};
