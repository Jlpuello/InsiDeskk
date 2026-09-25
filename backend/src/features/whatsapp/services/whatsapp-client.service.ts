import axios from 'axios';
import crypto from 'node:crypto';
import { platformSettingsService } from '../../settings/services/platform-settings.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { logger } from '../../../shared/utils/logger.js';

const GRAPH_API_VERSION = 'v20.0';

// Cliente delgado sobre la API oficial de Meta (WhatsApp Business Cloud API)
// — sin intermediario tipo Twilio, mismo criterio elegido en Configuración
// (ver platform-settings.service.ts).
export class WhatsappClientService {
  async sendTextMessage(toPhone: string, texto: string): Promise<void> {
    const config = await platformSettingsService.getEffectiveWhatsappConfig();
    if (!config) throw new AppError('WhatsApp no está configurado', 422);

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.phoneNumberId}/messages`;
    try {
      await axios.post(
        url,
        { messaging_product: 'whatsapp', to: toPhone, type: 'text', text: { body: texto } },
        { headers: { Authorization: `Bearer ${config.accessToken}` } },
      );
    } catch (err) {
      // La causa más común acá (fuera de credenciales inválidas) es la
      // "ventana de 24h": Meta rechaza texto libre si pasó más de 24h desde
      // el último mensaje del contacto y exige una plantilla pre-aprobada —
      // no implementado en esta ronda (ver conversationService.postMessageStaff,
      // que solo loggea este error sin romper el flujo).
      if (axios.isAxiosError(err)) {
        logger.error(`Error enviando mensaje de WhatsApp: ${err.message}`, { response: err.response?.data });
        throw new AppError('No se pudo enviar el mensaje por WhatsApp', err.response?.status ?? 502);
      }
      throw err;
    }
  }

  // Firma que Meta manda en cada llamada al webhook (header
  // X-Hub-Signature-256) — HMAC-SHA256 del body CRUDO con el App Secret de
  // la app (NO el access token). Ver app.ts (captura req.rawBody) y
  // whatsapp.public.routes.ts.
  verifySignature(rawBody: Buffer, header: string | undefined, appSecret: string): boolean {
    if (!header?.startsWith('sha256=')) return false;

    const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const provided = header.slice('sha256='.length);
    if (expected.length !== provided.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  }
}

export const whatsappClientService = new WhatsappClientService();
