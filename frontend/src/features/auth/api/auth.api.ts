import { apiClient } from '../../../shared/api/client.ts';
import type { AuthUser } from '../store/auth.store.ts';

// El backend puede responder de dos formas distintas a /auth/login según si
// el usuario tiene 2FA activo (ver AuthService.login) — nunca las dos a la
// vez. requiresTwoFactor=true no trae cookies de sesión todavía (ver
// LoginPage.tsx, que recién llama a loginTwoFactor con el código).
export interface LoginResponse {
  user?: AuthUser;
  requiresTwoFactor?: boolean;
  pendingToken?: string;
}

export const authApi = {
  // Los tokens llegan como cookies httpOnly (Set-Cookie), no en el body.
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', { email, password });
    return data.data;
  },

  // Segundo paso cuando login() devuelve requiresTwoFactor — code es el
  // token de 6 dígitos de la app autenticadora, o un código de respaldo.
  async loginTwoFactor(pendingToken: string, code: string): Promise<{ user: AuthUser }> {
    const { data } = await apiClient.post<{ data: { user: AuthUser } }>('/auth/login/2fa', { pendingToken, code });
    return data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },
};
