import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { hasPermission, type Permission } from '../security/permissions.ts';

interface StaffRouteProps {
  children: ReactNode;
  // Además de admin/técnico — para secciones que un admin puede
  // habilitar/deshabilitar por técnico puntual (ver Usuarios → Permisos).
  // admin siempre pasa (bypass de hasPermission).
  permission?: Permission;
}

// Admin + técnico, a diferencia de AdminRoute (solo admin) — para features
// operativas internas donde el cliente no debería entrar (ver Inventario).
export function StaffRoute({ children, permission }: StaffRouteProps) {
  const user = useAuthStore((state) => state.user);

  if (user?.rol !== 'admin' && user?.rol !== 'tecnico') {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
