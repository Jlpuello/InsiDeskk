import { apiClient } from '../../../shared/api/client.ts';
import type {
  RemotelySettings,
  UpdateRemotelySettingsInput,
  WhatsappSettings,
  UpdateWhatsappSettingsInput,
  AiSettings,
  UpdateAiSettingsInput,
  DefaultCompanySettings,
  EmailSettings,
  UpdateEmailSettingsInput,
  OrganizationSettings,
  UpdateOrganizationSettingsInput,
} from '../types/settings.types.ts';

export const settingsApi = {
  async getRemotely(): Promise<RemotelySettings> {
    const { data } = await apiClient.get<{ data: RemotelySettings }>('/settings/remotely');
    return data.data;
  },

  async updateRemotely(input: UpdateRemotelySettingsInput): Promise<RemotelySettings> {
    const { data } = await apiClient.put<{ data: RemotelySettings }>('/settings/remotely', input);
    return data.data;
  },

  async getWhatsapp(): Promise<WhatsappSettings> {
    const { data } = await apiClient.get<{ data: WhatsappSettings }>('/settings/whatsapp');
    return data.data;
  },

  async updateWhatsapp(input: UpdateWhatsappSettingsInput): Promise<WhatsappSettings> {
    const { data } = await apiClient.put<{ data: WhatsappSettings }>('/settings/whatsapp', input);
    return data.data;
  },

  async getAi(): Promise<AiSettings> {
    const { data } = await apiClient.get<{ data: AiSettings }>('/settings/ai');
    return data.data;
  },

  async updateAi(input: UpdateAiSettingsInput): Promise<AiSettings> {
    const { data } = await apiClient.put<{ data: AiSettings }>('/settings/ai', input);
    return data.data;
  },

  async getDefaultCompany(): Promise<DefaultCompanySettings> {
    const { data } = await apiClient.get<{ data: DefaultCompanySettings }>('/settings/default-company');
    return data.data;
  },

  async updateDefaultCompany(companyId: string | null): Promise<DefaultCompanySettings> {
    const { data } = await apiClient.put<{ data: DefaultCompanySettings }>('/settings/default-company', { companyId });
    return data.data;
  },

  async getEmail(): Promise<EmailSettings> {
    const { data } = await apiClient.get<{ data: EmailSettings }>('/settings/email');
    return data.data;
  },

  async updateEmail(input: UpdateEmailSettingsInput): Promise<EmailSettings> {
    const { data } = await apiClient.put<{ data: EmailSettings }>('/settings/email', input);
    return data.data;
  },

  async getOrganization(): Promise<OrganizationSettings> {
    const { data } = await apiClient.get<{ data: OrganizationSettings }>('/settings/organization');
    return data.data;
  },

  async updateOrganization(input: UpdateOrganizationSettingsInput): Promise<OrganizationSettings> {
    const { data } = await apiClient.put<{ data: OrganizationSettings }>('/settings/organization', input);
    return data.data;
  },
};
