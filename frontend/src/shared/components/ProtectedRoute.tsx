import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
