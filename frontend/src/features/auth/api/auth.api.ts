import { apiClient } from '../../../shared/api/client.ts';
import type { AuthUser } from '../store/auth.store.ts';

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
    return data.data;
  },
};
