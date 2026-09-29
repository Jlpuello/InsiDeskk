export interface RemotelySettings {
  remotelyServerUrl: string;
  // El ID del token no es secreto — Remotely siempre lo muestra en su tabla
  // de tokens (Account → API Access), así que se puede ver tal cual acá.
  remotelyApiKeyId: string | null;
  remotelyApiKeySet: boolean;
  updatedAt: string | null;
}

export interface UpdateRemotelySettingsInput {
  remotelyServerUrl?: string;
  // Van siempre juntos.
  remotelyApiKeyId?: string;
  remotelyApiKeySecret?: string;
}

export interface WhatsappSettings {
  whatsappPhoneNumberId: string | null;
  whatsappBusinessAccountId: string | null;
  whatsappAccessTokenSet: boolean;
  whatsappAppSecretSet: boolean;
  // Este SÍ viaja en claro (no es una credencial de acceso) — hace falta
  // para pegarlo tal cual en el dashboard de Meta al dar de alta el webhook.
  whatsappWebhookVerifyToken: string | null;
  updatedAt: string | null;
}

export interface UpdateWhatsappSettingsInput {
  whatsappPhoneNumberId?: string;
  whatsappBusinessAccountId?: string;
  // Van siempre juntos.
  whatsappAccessToken?: string;
  whatsappAppSecret?: string;
  whatsappWebhookVerifyToken?: string;
}

export interface AiSettings {
  aiProvider: string | null;
  aiModel: string | null;
  aiApiKeySet: boolean;
  aiEnabled: boolean;
  // El .md que carga el admin (tono, pasos básicos, cuándo escalar) — viaja
  // en claro, no es secreto.
  aiSystemPrompt: string | null;
  updatedAt: string | null;
}

export interface UpdateAiSettingsInput {
  // Van siempre juntos.
  aiProvider?: string;
  aiModel?: string;
  aiApiKey?: string;
  aiEnabled?: boolean;
  aiSystemPrompt?: string;
}

// Empresa a la que quedan los tickets del bot cuando quien reporta no tiene
// NIT (soporte a un particular) — ver public-ticket.controller.ts.
export interface DefaultCompanySettings {
  id: string | null;
  nombre: string | null;
}

export interface EmailSettings {
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

// Identidad legal de la empresa que OPERA esta instancia de InsiDesk (no las
// Company cliente) — se usa como membrete en cotizaciones/informes/actas en
// PDF y en la home pública. Nada acá es secreto.
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

// Título/descripción/keywords de las páginas públicas — ver useSeoMeta.
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
