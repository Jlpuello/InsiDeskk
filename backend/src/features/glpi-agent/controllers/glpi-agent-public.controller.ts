import type { Request, Response } from 'express';
import { glpiAgentService } from '../services/glpi-agent.service.js';
import type { GlpiContactRequest, GlpiInventoryRequest } from '../types/glpi-agent.types.js';

// Sin auth a propósito, igual que /api/public/remotely (ver
// remotely-public.controller.ts): lo llama el propio GLPI Agent instalado en
// el equipo del cliente, que no tiene cuenta ni JWT. La "autenticación" acá
// es el tag configurado en el agente (--tag=<...>) — sin un tag que mapee a
// una empresa real (Company.glpiAgentTag, configurado por un admin), el
// equipo nunca se da de alta (ver glpi-agent.service.ts#inventory). Un mismo
// endpoint atiende los dos pasos del protocolo JSON de GLPI
// (contact/inventory), distinguidos por `action` — así es como lo manda el
// agente real, no una elección nuestra.
export const GlpiAgentPublicController = {
  async handle(req: Request, res: Response): Promise<void> {
    const body = req.body as { action?: string; deviceid?: string };

    if (body.action === 'contact') {
      const result = await glpiAgentService.contact(body as GlpiContactRequest);
      res.status(result.status === 'error' ? 400 : 200).json(result);
      return;
    }

    // `action` es "inventory" o directamente ausente (default según el
    // protocolo — ver glpi-json-protocol.readthedocs.io/en/latest/inventory.html).
    if (!body.action || body.action === 'inventory') {
      const result = await glpiAgentService.inventory(body as GlpiInventoryRequest);
      res.status(result.status === 'error' ? 400 : 200).json(result);
      return;
    }

    res.status(400).json({ status: 'error', expiration: 1, message: 'unsupported-action' });
  },
};
