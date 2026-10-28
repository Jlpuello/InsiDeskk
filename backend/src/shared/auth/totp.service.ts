import { generate, generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

const ISSUER = 'InsiDesk';
// Tolerancia de reloj: ±60s (hasta 2 períodos de 30s) — otplib confirmado en
// vivo (node_modules/otplib no tiene la API vieja de `authenticator`, es una
// reescritura completa async-first en v13): epoch/epochTolerance van en
// SEGUNDOS, no ms — pasarlos en ms rompe la verificación en silencio (ningún
// código matchea nunca) sin ningún error, así se confirmó primero contra el
// paquete real antes de escribir esto.
const EPOCH_TOLERANCE_SECONDS = 60;

export const totpService = {
  generateSecret(): string {
    return generateSecret();
  },

  // Usado solo por los smoke tests (simula lo que generaría la app
  // autenticadora del usuario) — nunca se llama desde un flujo real.
  async generateToken(secret: string): Promise<string> {
    return generate({ secret });
  },

  buildOtpauthUrl(secret: string, accountEmail: string): string {
    return generateURI({ issuer: ISSUER, label: accountEmail, secret });
  },

  async buildQrCodeDataUrl(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  },

  // otplib valida la FORMA del token antes de comparar nada — un valor que no
  // tenga pinta de TOTP (largo distinto a 6, no numérico) tira una excepción
  // en vez de resolver {valid:false} (confirmado en vivo: "Token must be 6
  // digits, got 11" al probarlo con un código de respaldo real, de 11
  // caracteres con guion). authService.loginWithTwoFactor prueba acá primero
  // y recién si falla cae a los códigos de respaldo — sin este catch, loguear
  // con un código de respaldo rompía con un 500 en vez de seguir ese camino.
  async verifyToken(secret: string, token: string): Promise<boolean> {
    try {
      const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE_SECONDS });
      return result.valid;
    } catch {
      return false;
    }
  },
};
