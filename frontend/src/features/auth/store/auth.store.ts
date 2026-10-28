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
  // Ver features/account — admin lo exige (guard en App.tsx), tecnico/cliente
  // lo activan si quieren. Igual que `rol`/`permisos`, queda desactualizado
  // hasta el próximo login/acción de cuenta si cambia por otro medio.
  twoFactorEnabled: boolean;
}

interface AuthState {
  user: AuthUser | null;
  setSession: (user: AuthUser) => void;
  // Solo limpia el estado local — la cookie de sesión (httpOnly, no accesible
  // desde JS) la borra el backend en POST /auth/logout, ver TopBar.tsx.
  logout: () => void;
}

function readStoredUser(): AuthUser | null {
  try {
    return JSON.parse(localStorage.getItem('auth_user') ?? 'null');
  } catch {
    return null;
  }
}

// Los tokens ya NO viven acá: van en cookies httpOnly que el navegador manda
// solo (un XSS no puede leerlas). Lo único que se guarda es el perfil del
// usuario — no es un secreto — para saber si hay sesión y qué mostrar.
export const useAuthStore = create<AuthState>((set) => ({
  user: readStoredUser(),

  setSession: (user) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('auth_user');
    set({ user: null });
  },
}));
