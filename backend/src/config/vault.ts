import { logger } from '../shared/utils/logger.js';

// Placeholder: en producción esto debería leer secretos de un vault real
// (HashiCorp Vault, AWS Secrets Manager, etc.). Hoy los secretos vienen de
// variables de entorno (env.ts ya los valida al importarse) — este servicio
// solo deja el punto de extensión que espera server.ts para el día en que se
// conecte a un vault de verdad.
export const vaultService = {
  async loadSecrets(): Promise<void> {
    logger.info('Vault: usando variables de entorno (no hay un vault real configurado todavía)');
  },
};
