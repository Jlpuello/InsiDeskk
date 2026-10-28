import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../features/auth/store/auth.store.ts';
import { authApi } from '../../features/auth/api/auth.api.ts';
import { NotificationBell } from './NotificationBell.tsx';
import { ConfirmModal } from './ConfirmModal.tsx';
import { MessagesIndicator } from './MessagesIndicator.tsx';

interface TopBarProps {
  onOpenMobileNav: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  tecnico: 'Técnico',
  cliente: 'Cliente',
};

// Iniciales para el avatar — primera letra de hasta las 2 primeras palabras
// del nombre ("Juan Pérez" → "JP", "Admin" → "A"), nunca más de 2 para que
// quepan cómodas en el círculo.
function initialsOf(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

// Barra persistente (a diferencia del header viejo, que solo existía en
// mobile) — agrupa lo que es "sobre la sesión actual" (notificaciones, quién
// sos, cerrar sesión), separado de la navegación en sí, que vive solo en el
// Sidebar. El botón de hamburguesa sigue siendo el mismo de siempre, solo que
// ahora vive acá en vez de en su propio header mobile-only.
export function TopBar({ onOpenMobileNav }: TopBarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Mismo patrón de "cerrar al clickear afuera" que NotificationBell.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // La cookie de sesión es httpOnly: solo el backend puede borrarla. Si el
  // request falla igual se limpia el estado local (la sesión vieja ya no sirve
  // de nada sin la UI que la usa).
  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignorado a propósito
    } finally {
      logout();
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <button
        onClick={onOpenMobileNav}
        aria-label="Abrir menú"
        className="rounded-md p-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="ml-auto flex items-center gap-3">
        {(user?.rol === 'admin' || user?.rol === 'tecnico') && <MessagesIndicator />}
        <NotificationBell />

        {user && (
          <>
            <div className="h-6 w-px bg-gray-200" />

            <div ref={menuRef} className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-gray-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {initialsOf(user.nombre)}
                </span>
                <div className="hidden text-right leading-tight sm:block">
                  <p className="text-sm font-medium text-gray-900">{user.nombre}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    {ROLE_LABELS[user.rol] ?? user.rol}
                  </p>
                </div>
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/account/security');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <ShieldCheck size={15} className="text-gray-400" /> Mi cuenta
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={15} /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showLogoutConfirm && (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Deseás cerrar sesión?"
          confirmLabel="Cerrar sesión"
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
        />
      )}
    </header>
  );
}
