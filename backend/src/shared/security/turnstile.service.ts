import axios from 'axios';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Gatekeeper de Cloudflare Turnstile para los caminos públicos que
// autoprovisionan una empresa o usan la empresa por defecto (ver
// public-ticket.controller.ts) — sin esto, un NIT no encontrado o "sin NIT"
// es la vía más barata para generar tickets/empresas en masa.
//
// Falla CERRADO si no hay secret key configurada: es un control de
// seguridad recién agregado, no una integración que deba degradarse sola
// dejando el camino abierto. El admin necesita crear una cuenta gratis de
// Cloudflare y setear TURNSTILE_SECRET_KEY (+ VITE_TURNSTILE_SITE_KEY en el
// frontend) antes de que este camino funcione.
export async function verifyTurnstileToken(token: string | undefined, remoteIp?: string): Promise<boolean> {
  if (!env.turnstileSecretKey) {
    logger.warn('Turnstile: TURNSTILE_SECRET_KEY no configurada — se rechaza la verificación (falla cerrado).');
    return false;
  }
  if (!token) return false;

  try {
    const { data } = await axios.post<{ success: boolean }>(
      VERIFY_URL,
      new URLSearchParams({
        secret: env.turnstileSecretKey,
        response: token,
        ...(remoteIp && { remoteip: remoteIp }),
      }),
    );
    return data.success === true;
  } catch (err) {
    logger.error(`Turnstile: error verificando el token: ${(err as Error).message}`);
    return false;
  }
}
