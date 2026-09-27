import { Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { AppLayout } from './AppLayout.tsx';
import { HomeRoute } from './HomeRoute.tsx';
import { HomeLandingPage } from '../../features/home/components/HomeLandingPage.tsx';

// "/" servía antes solo de dashboard autenticado (ProtectedRoute redirigía
// cualquier visita anónima directo a /login, sin mostrar nada de la app ni
// una forma de identificarla) — ahora decide según sesión: sin login, la
// home pública (marca, qué hacemos, cómo entrar); con sesión, el dashboard de
// siempre, exactamente igual que antes (Sidebar "Dashboard" también apunta
// acá, y solo lo ve gente ya logueada, así que nunca ve este otro lado).
// El <Routes> anidado es legal en React Router v6 y evita duplicar
// path="/" a nivel superior compitiendo con el grupo de AppLayout.
export function RootRoute() {
  const user = useAuthStore((state) => state.user);

  if (!user) return <HomeLandingPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRoute />} />
      </Route>
    </Routes>
  );
}
