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
    // sabe qué protocolo soporta y manda un PROLOG legacy en XML (heredado
    // de OCS Inventory/FusionInventory) antes de animarse a mandar CONTACT
    // en JSON. Los docs del protocolo JSON sugieren responder ese caso con
    // un error 4xx "unsupported content-type" — probado contra un agente
    // real (glpi-agent 1.21) y NO funciona: devolver 415 que no cambia nada,
    // el agente solo loguea "communication error" y reintenta el mismo XML
    // en el próximo ciclo para siempre. Revisando el código real del agente
    // (HTTP::Client::OCS#send): si la respuesta no es 2xx, ni siquiera mira
    // el cuerpo. Si SÍ es 2xx y el cuerpo es JSON (no parsea como XML), lo
    // intenta leer como CONTACT — ahí es donde "aprende" que este server
    // habla JSON y recién en ese mismo ciclo manda el CONTACT real en JSON
    // (con deviceid/tag), que es el que de verdad correlacionamos. Por eso
    // acá respondemos 200 con un CONTACT válido aunque no hayamos podido
    // leer nada útil del XML que mandó — no hace falta, ya viene el CONTACT
    // real a continuación.
    if (!req.is('application/json')) {
      res.status(200).json({ status: 'ok', expiration: 24 });
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
