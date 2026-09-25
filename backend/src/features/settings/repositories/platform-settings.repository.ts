import { getPrismaClient } from '../../../shared/prisma/client.js';

// Fila única — no hay una config por empresa, es global de la plataforma.
const SETTINGS_ID = 'singleton';

export interface PlatformSettingsData {
  remotelyServerUrl?: string;
  remotelyApiKeyId?: string;
  remotelyApiKeySecret?: string;
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  whatsappWebhookVerifyToken?: string;
  whatsappConfiguredAt?: Date;
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiEnabled?: boolean;
  aiSystemPrompt?: string;
  emailProvider?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
  // string | null (no solo string | undefined) porque el admin tiene que
  // poder LIMPIAR la empresa por defecto, no solo dejarla sin tocar.
  defaultCompanyId?: string | null;
  updatedById: string;
}

export class PlatformSettingsRepository {
  private get prisma() {
    return getPrismaClient();
  }

  async get() {
    return this.prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  }

  async upsert(data: PlatformSettingsData) {
    return this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...data },
      update: data,
    });
  }

  // Escritura del monitor de integridad (remotely-package-integrity.scheduler.ts),
  // separada de upsert() porque no la dispara un admin guardando Configuración
  // — no tiene sentido pedirle un updatedById.
  async setPackageHash(hash: string, checkedAt: Date) {
    return this.prisma.platformSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, remotelyPackageHash: hash, remotelyPackageHashCheckedAt: checkedAt },
      update: { remotelyPackageHash: hash, remotelyPackageHashCheckedAt: checkedAt },
    });
  }
}

export const platformSettingsRepository = new PlatformSettingsRepository();
