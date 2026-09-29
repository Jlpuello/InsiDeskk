import { platformSettingsRepository } from '../repositories/platform-settings.repository.js';
import { companyRepository } from '../../companies/repositories/company.repository.js';
import { encryptionService } from '../../../shared/utils/encryption.js';
import { cacheService } from '../../../shared/cache/cache.service.js';
import { logger } from '../../../shared/utils/logger.js';
import { env } from '../../../config/env.js';

// TTL corto: evita golpear la BD en cada llamada de RemotelyService (el
// poller de estado corre cada 5s), pero un cambio guardado desde la UI se
// refleja rápido igual (además, update() invalida la key de una).
const CACHE_KEY = 'settings:remotely';
const CACHE_TTL = 30;

// El webhook de WhatsApp lo consulta en CADA mensaje entrante — igual que
// Remotely, cachea corto en vez de pegarle a la base en cada request de Meta.
const WHATSAPP_CACHE_KEY = 'settings:whatsapp-effective';
const WHATSAPP_CACHE_TTL = 30;

export interface RemotelyPublicSettings {
  remotelyServerUrl: string;
  // El ID del token no es secreto (Remotely lo muestra siempre en su tabla de
  // tokens) — se puede mostrar tal cual para que el admin confirme cuál está activo.
  remotelyApiKeyId: string | null;
  remotelyApiKeySet: boolean;
  updatedAt: string | null;
}

export interface UpdateRemotelySettingsInput {
  remotelyServerUrl?: string;
  // Van siempre juntos: no tiene sentido cambiar uno sin el otro (ver
  // controller — Joi los valida con .and()).
  remotelyApiKeyId?: string;
  remotelyApiKeySecret?: string;
}

export interface EffectiveRemotelyConfig {
  serverUrl: string;
  // Ya combinado "id:secreto" — el formato exacto que Remotely espera en el
  // header X-Api-Key (ver ApiAuthorizationFilter en el código fuente de Remotely).
  apiKey: string;
}

// WhatsApp Business Cloud API (Meta) — webhook receptor y envío real en
// features/whatsapp/, consumidos vía getEffectiveWhatsappConfig() de acá abajo.
export interface WhatsappPublicSettings {
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  whatsappAccessTokenSet: boolean;
  whatsappAppSecretSet: boolean;
  // A diferencia de accessToken/appSecret, este SÍ se devuelve en claro: el
  // admin lo necesita para pegarlo tal cual en el dashboard de Meta
  // (hub.verify_token). No es una credencial de acceso — por sí solo no
  // permite mandar/leer mensajes, solo confirma la propiedad del endpoint al
  // dar de alta el webhook; la seguridad real de cada mensaje viene de la
  // firma HMAC con el App Secret (ver whatsapp-client.service.ts).
  whatsappWebhookVerifyToken: string | null;
  updatedAt: string | null;
}

export interface UpdateWhatsappSettingsInput {
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  // Van siempre juntos: un access token solo sirve para el phone number con
  // el que se generó (ver controller — Joi los valida con .and()).
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  whatsappWebhookVerifyToken?: string;
}

// Uso interno de features/whatsapp/ únicamente — nunca se expone por HTTP.
// null si falta cualquiera de los 4 campos (no tiene sentido operar con
// una config a medias: no se podría ni firmar el webhook ni mandar mensajes).
export interface EffectiveWhatsappConfig {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
}

// IA para el chat de soporte — la key se guarda cifrada; aiSystemPrompt (el
// .md que carga el admin) viaja en claro porque no es secreto, es contexto
// de negocio (tono, pasos básicos, cuándo escalar).
export interface AiPublicSettings {
  aiProvider: string | null;
  aiModel: string | null;
  aiApiKeySet: boolean;
  aiEnabled: boolean;
  aiSystemPrompt: string | null;
  updatedAt: string | null;
}

export interface UpdateAiSettingsInput {
  // Van siempre juntos: una key solo tiene sentido para el proveedor con el
  // que se generó (ver controller — Joi los valida con .and()).
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiEnabled?: boolean;
  aiSystemPrompt?: string;
}

// Uso interno de features/ai/ únicamente — nunca por HTTP. null si falta
// cualquiera de los campos imprescindibles para poder llamar al proveedor
// (aiSystemPrompt puede venir vacío, no es imprescindible).
export interface EffectiveAiConfig {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
}

// Envío de correo — Resend (env vars, comportamiento de siempre) o SMTP
// propio. smtpPassword ("contraseña de aplicación") es el único secreto acá.
export interface EmailPublicSettings {
  emailProvider: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPasswordSet: boolean;
  smtpFrom: string | null;
  smtpSecure: boolean | null;
  updatedAt: string | null;
}

export interface UpdateEmailSettingsInput {
  emailProvider?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
}

// Uso interno de features/notifications/ únicamente — nunca por HTTP. null
// si el proveedor configurado no es 'smtp' o falta algún campo imprescindible.
export interface EffectiveEmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  secure: boolean;
}

// Identidad legal de la empresa que opera esta instancia (no la Company
// cliente) — se usa como membrete en cotizaciones/informes/actas (PDF) y en
// la landing pública (ver getOrganizationPublic / GET /api/public/organization).
// Nada acá es secreto, a diferencia del resto de PlatformSettings.
export interface OrganizationSettings {
  orgRazonSocial: string | null;
  orgNit: string | null;
  orgTelefono: string | null;
  orgEmail: string | null;
  updatedAt: string | null;
}

export interface UpdateOrganizationSettingsInput {
  orgRazonSocial?: string;
  orgNit?: string;
  orgTelefono?: string;
  orgEmail?: string;
}

// Subconjunto expuesto sin login (landing /soporte y la futura home pública)
// — mismos datos que OrganizationSettings (nada es secreto), separado nomás
// para que un cambio futuro que sí agregue algo sensible a PlatformSettings
// no lo exponga por accidente acá.
export interface OrganizationPublicInfo {
  razonSocial: string | null;
  nit: string | null;
  telefono: string | null;
  email: string | null;
}

// Título/descripción/keywords para las páginas públicas (home, /soporte,
// /reportar) — sin SSR, esto se aplica client-side (ver useSeoMeta en el
// frontend), así que ayuda al tab del navegador y a cualquier crawler que
// ejecute JS, pero no a un scraper de preview (Slack/WhatsApp) que solo lee
// el HTML crudo — para eso, index.html trae sus propios valores por defecto.
export interface SeoSettings {
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
  seoMetaKeywords: string | null;
  updatedAt: string | null;
}

export interface UpdateSeoSettingsInput {
  seoMetaTitle?: string;
  seoMetaDescription?: string;
  seoMetaKeywords?: string;
}

export class PlatformSettingsService {
  // Vista segura para la UI: el secreto NUNCA viaja, ni completo ni
  // enmascarado — solo un flag de si está configurado. El ID sí se muestra
  // (no es secreto) para que el admin vea qué token está activo sin tener
  // que ir a revisar la tabla de Remotely.
  async getPublic(): Promise<RemotelyPublicSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      remotelyServerUrl: settings?.remotelyServerUrl || env.remotelyServerUrl,
      remotelyApiKeyId: settings?.remotelyApiKeyId ?? null,
      remotelyApiKeySet: Boolean(settings?.remotelyApiKeySecret || env.remotelyApiKey),
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async update(input: UpdateRemotelySettingsInput, updatedById: string): Promise<RemotelyPublicSettings> {
    await platformSettingsRepository.upsert({
      ...(input.remotelyServerUrl !== undefined && { remotelyServerUrl: input.remotelyServerUrl }),
      ...(input.remotelyApiKeyId && { remotelyApiKeyId: input.remotelyApiKeyId }),
      ...(input.remotelyApiKeySecret && { remotelyApiKeySecret: input.remotelyApiKeySecret }),
      updatedById,
    });

    await cacheService.delete(CACHE_KEY);
    logger.info(`Configuración de Remotely actualizada por ${updatedById}`);

    return this.getPublic();
  }

  // Solo para uso interno de RemotelyService — nunca se expone por HTTP.
  // Si no hay fila guardada (o falta algún campo), cae a la variable de
  // entorno REMOTELY_API_KEY (ya en formato "id:secreto") — así el .env sigue
  // funcionando de entrada, sin forzar a pasar por Configuración antes de que
  // Remotely funcione.
  async getEffectiveConfig(): Promise<EffectiveRemotelyConfig> {
    const cached = await cacheService.get<EffectiveRemotelyConfig>(CACHE_KEY);
    if (cached) return cached;

    const settings = await platformSettingsRepository.get();

    const apiKey =
      settings?.remotelyApiKeyId && settings.remotelyApiKeySecret
        ? `${settings.remotelyApiKeyId}:${encryptionService.decrypt(settings.remotelyApiKeySecret)}`
        : env.remotelyApiKey;

    const config: EffectiveRemotelyConfig = {
      serverUrl: settings?.remotelyServerUrl || env.remotelyServerUrl,
      apiKey,
    };

    await cacheService.set(CACHE_KEY, config, CACHE_TTL);
    return config;
  }

  // Sin cache: a diferencia de Remotely (poller cada 5s), esto solo lo lee
  // la pantalla de Configuración — no vale la pena la complejidad extra.
  async getWhatsappPublic(): Promise<WhatsappPublicSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      whatsappPhoneNumberId: settings?.whatsappPhoneNumberId ?? null,
      whatsappBusinessAccountId: settings?.whatsappBusinessAccountId ?? null,
      whatsappAccessTokenSet: Boolean(settings?.whatsappAccessToken),
      whatsappAppSecretSet: Boolean(settings?.whatsappAppSecret),
      whatsappWebhookVerifyToken: settings?.whatsappWebhookVerifyToken
        ? encryptionService.decrypt(settings.whatsappWebhookVerifyToken)
        : null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateWhatsapp(input: UpdateWhatsappSettingsInput, updatedById: string): Promise<WhatsappPublicSettings> {
    await platformSettingsRepository.upsert({
      ...(input.whatsappPhoneNumberId !== undefined && { whatsappPhoneNumberId: input.whatsappPhoneNumberId }),
      ...(input.whatsappBusinessAccountId !== undefined && { whatsappBusinessAccountId: input.whatsappBusinessAccountId }),
      ...(input.whatsappAccessToken && { whatsappAccessToken: input.whatsappAccessToken }),
      ...(input.whatsappAppSecret && { whatsappAppSecret: input.whatsappAppSecret }),
      ...(input.whatsappWebhookVerifyToken && { whatsappWebhookVerifyToken: input.whatsappWebhookVerifyToken }),
      ...((input.whatsappAccessToken || input.whatsappPhoneNumberId) && { whatsappConfiguredAt: new Date() }),
      updatedById,
    });

    await cacheService.delete(WHATSAPP_CACHE_KEY);
    logger.info(`Configuración de WhatsApp actualizada por ${updatedById}`);
    return this.getWhatsappPublic();
  }

  // Uso interno de features/whatsapp/ (webhook + envío) — nunca por HTTP.
  async getEffectiveWhatsappConfig(): Promise<EffectiveWhatsappConfig | null> {
    const cached = await cacheService.get<EffectiveWhatsappConfig>(WHATSAPP_CACHE_KEY);
    if (cached) return cached;

    const settings = await platformSettingsRepository.get();
    if (
      !settings?.whatsappPhoneNumberId ||
      !settings.whatsappAccessToken ||
      !settings.whatsappAppSecret ||
      !settings.whatsappWebhookVerifyToken
    ) {
      return null;
    }

    const config: EffectiveWhatsappConfig = {
      phoneNumberId: settings.whatsappPhoneNumberId,
      accessToken: encryptionService.decrypt(settings.whatsappAccessToken),
      appSecret: encryptionService.decrypt(settings.whatsappAppSecret),
      webhookVerifyToken: encryptionService.decrypt(settings.whatsappWebhookVerifyToken),
    };

    await cacheService.set(WHATSAPP_CACHE_KEY, config, WHATSAPP_CACHE_TTL);
    return config;
  }

  async getAiPublic(): Promise<AiPublicSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      aiProvider: settings?.aiProvider ?? null,
      aiModel: settings?.aiModel ?? null,
      aiApiKeySet: Boolean(settings?.aiApiKey),
      aiEnabled: settings?.aiEnabled ?? false,
      aiSystemPrompt: settings?.aiSystemPrompt ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateAi(input: UpdateAiSettingsInput, updatedById: string): Promise<AiPublicSettings> {
    await platformSettingsRepository.upsert({
      ...(input.aiProvider !== undefined && { aiProvider: input.aiProvider }),
      ...(input.aiModel !== undefined && { aiModel: input.aiModel }),
      ...(input.aiApiKey && { aiApiKey: input.aiApiKey }),
      ...(input.aiEnabled !== undefined && { aiEnabled: input.aiEnabled }),
      ...(input.aiSystemPrompt !== undefined && { aiSystemPrompt: input.aiSystemPrompt }),
      updatedById,
    });

    logger.info(`Configuración de IA actualizada por ${updatedById}`);
    return this.getAiPublic();
  }

  // Uso interno de features/ai/ (POST /api/public/ai-chat) — nunca por HTTP.
  async getEffectiveAiConfig(): Promise<EffectiveAiConfig | null> {
    const settings = await platformSettingsRepository.get();
    if (!settings?.aiEnabled || !settings.aiProvider || !settings.aiModel || !settings.aiApiKey) {
      return null;
    }
    return {
      provider: settings.aiProvider,
      model: settings.aiModel,
      apiKey: encryptionService.decrypt(settings.aiApiKey),
      systemPrompt: settings.aiSystemPrompt ?? '',
    };
  }

  async getEmailPublic(): Promise<EmailPublicSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      emailProvider: settings?.emailProvider ?? null,
      smtpHost: settings?.smtpHost ?? null,
      smtpPort: settings?.smtpPort ?? null,
      smtpUser: settings?.smtpUser ?? null,
      smtpPasswordSet: Boolean(settings?.smtpPassword),
      smtpFrom: settings?.smtpFrom ?? null,
      smtpSecure: settings?.smtpSecure ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateEmail(input: UpdateEmailSettingsInput, updatedById: string): Promise<EmailPublicSettings> {
    await platformSettingsRepository.upsert({
      ...(input.emailProvider !== undefined && { emailProvider: input.emailProvider }),
      ...(input.smtpHost !== undefined && { smtpHost: input.smtpHost }),
      ...(input.smtpPort !== undefined && { smtpPort: input.smtpPort }),
      ...(input.smtpUser !== undefined && { smtpUser: input.smtpUser }),
      ...(input.smtpPassword && { smtpPassword: input.smtpPassword }),
      ...(input.smtpFrom !== undefined && { smtpFrom: input.smtpFrom }),
      ...(input.smtpSecure !== undefined && { smtpSecure: input.smtpSecure }),
      updatedById,
    });

    logger.info(`Configuración de email actualizada por ${updatedById}`);
    return this.getEmailPublic();
  }

  // Uso interno de features/notifications/jobs/send-email.job.ts — nunca por
  // HTTP. null si el proveedor no es 'smtp' o falta algún campo — en ese
  // caso el job cae al camino de Resend de siempre.
  async getOrganization(): Promise<OrganizationSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      orgRazonSocial: settings?.orgRazonSocial ?? null,
      orgNit: settings?.orgNit ?? null,
      orgTelefono: settings?.orgTelefono ?? null,
      orgEmail: settings?.orgEmail ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateOrganization(input: UpdateOrganizationSettingsInput, updatedById: string): Promise<OrganizationSettings> {
    await platformSettingsRepository.upsert({
      ...(input.orgRazonSocial !== undefined && { orgRazonSocial: input.orgRazonSocial }),
      ...(input.orgNit !== undefined && { orgNit: input.orgNit }),
      ...(input.orgTelefono !== undefined && { orgTelefono: input.orgTelefono }),
      ...(input.orgEmail !== undefined && { orgEmail: input.orgEmail }),
      updatedById,
    });

    logger.info(`Datos de organización actualizados por ${updatedById}`);
    return this.getOrganization();
  }

  // Sin login — landing pública y membrete de PDFs (acta-pdf.service.ts,
  // quote-pdf.service.ts vía sus callers). Un campo vacío no rompe nada: cada
  // consumidor decide cómo mostrar la ausencia (ver formatIssuerLine en
  // document-pdf.ts para el caso de los PDF).
  async getOrganizationPublic(): Promise<OrganizationPublicInfo> {
    const settings = await platformSettingsRepository.get();
    return {
      razonSocial: settings?.orgRazonSocial ?? null,
      nit: settings?.orgNit ?? null,
      telefono: settings?.orgTelefono ?? null,
      email: settings?.orgEmail ?? null,
    };
  }

  async getSeo(): Promise<SeoSettings> {
    const settings = await platformSettingsRepository.get();
    return {
      seoMetaTitle: settings?.seoMetaTitle ?? null,
      seoMetaDescription: settings?.seoMetaDescription ?? null,
      seoMetaKeywords: settings?.seoMetaKeywords ?? null,
      updatedAt: settings?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateSeo(input: UpdateSeoSettingsInput, updatedById: string): Promise<SeoSettings> {
    await platformSettingsRepository.upsert({
      ...(input.seoMetaTitle !== undefined && { seoMetaTitle: input.seoMetaTitle }),
      ...(input.seoMetaDescription !== undefined && { seoMetaDescription: input.seoMetaDescription }),
      ...(input.seoMetaKeywords !== undefined && { seoMetaKeywords: input.seoMetaKeywords }),
      updatedById,
    });

    logger.info(`Configuración de SEO actualizada por ${updatedById}`);
    return this.getSeo();
  }

  // Sin login — lo consume useSeoMeta en las páginas públicas.
  async getSeoPublic(): Promise<Omit<SeoSettings, 'updatedAt'>> {
    const settings = await platformSettingsRepository.get();
    return {
      seoMetaTitle: settings?.seoMetaTitle ?? null,
      seoMetaDescription: settings?.seoMetaDescription ?? null,
      seoMetaKeywords: settings?.seoMetaKeywords ?? null,
    };
  }

  async getEffectiveEmailConfig(): Promise<EffectiveEmailConfig | null> {
    const settings = await platformSettingsRepository.get();
    if (
      settings?.emailProvider !== 'smtp' ||
      !settings.smtpHost ||
      !settings.smtpPort ||
      !settings.smtpUser ||
      !settings.smtpPassword ||
      !settings.smtpFrom
    ) {
      return null;
    }
    return {
      host: settings.smtpHost,
      port: settings.smtpPort,
      user: settings.smtpUser,
      password: encryptionService.decrypt(settings.smtpPassword),
      from: settings.smtpFrom,
      secure: settings.smtpSecure ?? false,
    };
  }

  // Empresa a la que quedan los tickets del bot cuando quien reporta no
  // tiene NIT — ver public-ticket.controller.ts. Se resuelve el nombre acá
  // (no solo el id) para que la UI lo muestre sin una consulta aparte.
  async getDefaultCompany(): Promise<{ id: string | null; nombre: string | null }> {
    const settings = await platformSettingsRepository.get();
    if (!settings?.defaultCompanyId) return { id: null, nombre: null };

    const company = await companyRepository.findById(settings.defaultCompanyId);
    // Si la empresa se borró/desactivó del lado de Empresas, no rompe acá —
    // simplemente se muestra como "sin configurar" hasta que el admin elija
    // otra.
    return company ? { id: company.id, nombre: company.nombre } : { id: null, nombre: null };
  }

  async updateDefaultCompany(companyId: string | null, updatedById: string): Promise<{ id: string | null; nombre: string | null }> {
    await platformSettingsRepository.upsert({ defaultCompanyId: companyId, updatedById });
    logger.info(`Empresa por defecto (tickets sin NIT) actualizada por ${updatedById}`);
    return this.getDefaultCompany();
  }

  // Uso interno del flujo público de tickets — nunca por HTTP directo (ver
  // public-ticket.controller.ts, camino sinNit:true).
  async getDefaultCompanyId(): Promise<string | null> {
    const settings = await platformSettingsRepository.get();
    return settings?.defaultCompanyId ?? null;
  }
}

export const platformSettingsService = new PlatformSettingsService();
