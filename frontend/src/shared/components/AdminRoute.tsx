import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';

export function AdminRoute({ children }: { children: ReactNode }) {
  const rol = useAuthStore((state) => state.user?.rol);

  if (rol !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
