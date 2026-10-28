import { apiClient } from '../../../shared/api/client.ts';
import type { AuthUser } from '../../auth/store/auth.store.ts';
import type { SecurityStatus, TwoFactorSetupResult } from '../types/account.types.ts';

export const accountApi = {
  async getSecurity(): Promise<SecurityStatus> {
    const { data } = await apiClient.get<{ data: SecurityStatus }>('/account/security');
    return data.data;
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
    const { data } = await apiClient.post<{ data: { user: AuthUser } }>('/account/password', {
      currentPassword,
      newPassword,
    });
    return data.data.user;
  },

  async setupTwoFactor(): Promise<TwoFactorSetupResult> {
    const { data } = await apiClient.post<{ data: TwoFactorSetupResult }>('/account/2fa/setup');
    return data.data;
  },

  // Códigos de respaldo: se devuelven en texto plano UNA sola vez — no hay
  // forma de volver a pedirlos después (ver SecurityPage.tsx).
  async verifyTwoFactor(code: string): Promise<{ backupCodes: string[]; user: AuthUser }> {
    const { data } = await apiClient.post<{ data: { backupCodes: string[]; user: AuthUser } }>('/account/2fa/verify', {
      code,
    });
    return data.data;
  },

  async disableTwoFactor(currentPassword: string): Promise<AuthUser> {
    const { data } = await apiClient.post<{ data: { user: AuthUser } }>('/account/2fa/disable', { currentPassword });
    return data.data.user;
  },

  async revokeOtherSessions(): Promise<AuthUser> {
    const { data } = await apiClient.post<{ data: { user: AuthUser } }>('/account/sessions/revoke-others');
    return data.data.user;
  },
};
