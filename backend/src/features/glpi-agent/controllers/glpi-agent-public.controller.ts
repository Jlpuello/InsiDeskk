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
    // La primera vez que el agente habla con un server que no conoce, no
    // sabe qué protocolo soporta y manda un PROLOG legacy en XML (ver
    // glpi-json-protocol.readthedocs.io/en/latest/contact.html, sección
    // "how the agent determines the server's supported content types") — acá
    // solo entendemos JSON, así que express.json() ni parsea ese body
    // (Content-Type no matchea) y req.body queda vacío. Respondiendo acá con
    // el error "unsupported content-type" que define el protocolo, el agente
    // aprende que este server solo habla JSON y de ahí en más manda CONTACT
    // en JSON — sin esto, reintenta PROLOG en XML para siempre y el equipo
    // nunca se registra (aunque el server sea perfectamente alcanzable).
    if (!req.is('application/json')) {
      res.status(415).json({ status: 'error', message: 'unsupported content-type', expiration: 24 });
      return;
    }

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
