import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { hasPermission, type Permission } from '../security/permissions.ts';

interface ClienteRouteProps {
  children: ReactNode;
  permission?: Permission;
}

// Solo rol cliente — para pantallas que le pertenecen a la empresa cliente,
// no al equipo de soporte (ver "Aprobaciones pendientes" en features/quotes).
export function ClienteRoute({ children, permission }: ClienteRouteProps) {
  const user = useAuthStore((state) => state.user);

  if (user?.rol !== 'cliente') {
    return <Navigate to="/" replace />;
  }

  if (permission && !hasPermission(user, permission)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
