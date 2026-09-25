import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { DashboardPage } from '../../features/dashboard/components/DashboardPage.tsx';

// El Dashboard (KPIs de la operación) es para staff — no aparece en el nav
// para un cliente (ver Sidebar, staffOnly). Esto es la barrera real: si un
// cliente entra a "/" directo (URL escrita a mano, bookmark viejo), cae a su
// propia lista de tickets en vez de ver las métricas.
export function HomeRoute() {
  const rol = useAuthStore((state) => state.user?.rol);
  if (rol === 'cliente') return <Navigate to="/tickets" replace />;
  return <DashboardPage />;
}
