import type { Request, Response } from 'express';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import { whatsappClientService } from '../services/whatsapp-client.service.js';
import { conversationService } from '../../conversations/services/conversation.service.js';
import { logger } from '../../../shared/utils/logger.js';

// Formas mínimas del payload de Meta que realmente se usan acá — el resto
// del objeto (metadata, statuses de entrega, etc.) se ignora a propósito,
// esta ronda solo procesa mensajes de texto entrantes.
interface WhatsappWebhookBody {
  entry?: {
    changes?: {
      value?: {
        contacts?: { wa_id: string; profile?: { name?: string } }[];
        messages?: { from: string; type: string; text?: { body: string } }[];
      };
    }[];
  }[];
}

export const WhatsappPublicController = {
  // Meta llama esto UNA vez, al configurar el webhook en su dashboard, para
  // confirmar que el endpoint es realmente tuyo.
  async verify(req: Request, res: Response): Promise<void> {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const config = await platformSettingsService.getEffectiveWhatsappConfig();
    if (mode === 'subscribe' && config && token === config.webhookVerifyToken) {
      res.status(200).send(challenge);
      return;
    }
    res.sendStatus(403);
  },

  async receive(req: Request, res: Response): Promise<void> {
    const config = await platformSettingsService.getEffectiveWhatsappConfig();
    if (!config) {
      res.sendStatus(404);
      return;
    }

    const signature = req.header('x-hub-signature-256');
    if (!req.rawBody || !whatsappClientService.verifySignature(req.rawBody, signature, config.appSecret)) {
      logger.warn('Webhook de WhatsApp: firma inválida o ausente, rechazado');
      res.sendStatus(403);
      return;
    }

    // Confirmar rápido: Meta reintenta agresivamente si no responde 200 en
    // pocos segundos, y procesar (posible alta de Company) puede tardar más
    // de lo que espera un webhook.
    res.sendStatus(200);

    const body = req.body as WhatsappWebhookBody;
    try {
      for (const entry of body.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value;
          for (const msg of value?.messages ?? []) {
            if (msg.type !== 'text' || !msg.text) continue; // Otros tipos (imagen, audio...) quedan fuera de esta ronda.
            const nombreContacto = value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ?? msg.from;
            await conversationService.receiveWhatsappMessage(msg.from, nombreContacto, msg.text.body);
          }
        }
      }
    } catch (err) {
      logger.error(`Error procesando webhook de WhatsApp: ${(err as Error).message}`);
    }
  },
};
