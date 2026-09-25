import { apiClient } from '../../../shared/api/client.ts';
import type { AuthUser } from '../store/auth.store.ts';

export interface LoginResponse {
  user: AuthUser;
}

export const authApi = {
  // Los tokens llegan como cookies httpOnly (Set-Cookie), no en el body.
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
    return data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
