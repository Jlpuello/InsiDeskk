import { create } from 'zustand';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: 'admin' | 'tecnico' | 'cliente';
  empresaId?: string;
  // El backend ya lo manda en /auth/login (sanitizeUser solo saca
  // passwordHash) — ver shared/security/permissions.ts para el catálogo.
  // Nota: igual que `rol`, queda desactualizado hasta el próximo login si un
  // admin lo cambia en caliente (no hay refresh de perfil, mismo criterio que
  // ya se acepta hoy para el rol).
  permisos: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  // Solo los tokens, sin tocar `user` — usado por el interceptor de
  // shared/api/client.ts al renovar silenciosamente el access token vencido.
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

function readStoredUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem('auth_user') ?? 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),
  accessToken: localStorage.getItem('auth_access_token'),
  refreshToken: localStorage.getItem('auth_refresh_token'),

  setSession: (user, accessToken, refreshToken) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshToken);
    set({ user, accessToken, refreshToken });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem('auth_access_token', accessToken);
    localStorage.setItem('auth_refresh_token', refreshToken);
    set({ accessToken, refreshToken });
  },

  logout: () => {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
