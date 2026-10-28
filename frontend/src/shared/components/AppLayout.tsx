import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { Sidebar } from './Sidebar.tsx';
import { TopBar } from './TopBar.tsx';

const TWO_FACTOR_SETUP_PATH = '/account/security';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  // El rol admin exige 2FA activo (ver features/account) — hasta que lo
  // configure, cualquier otra ruta redirige acá. Se chequea en un solo lugar
  // (el layout que envuelve TODAS las rutas autenticadas) en vez de en cada
  // ruta — así no hay forma de que una nueva pantalla se cuele sin el guard.
  const mustSetUpTwoFactor = user?.rol === 'admin' && !user.twoFactorEnabled && location.pathname !== TWO_FACTOR_SETUP_PATH;

  return (
    <div className="flex min-h-screen">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      {/* min-w-0 es necesario: sin esto, un hijo de flex no se achica más allá
          del ancho de su contenido y termina desbordando en vez de que el
          texto/selects hagan wrap — es lo que rompía el layout en mobile. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50">
          {mustSetUpTwoFactor ? <Navigate to={TWO_FACTOR_SETUP_PATH} replace /> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
