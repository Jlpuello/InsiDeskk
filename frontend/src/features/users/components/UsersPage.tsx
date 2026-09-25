import { useState } from 'react';
import clsx from 'clsx';
import { UserList } from './UserList.tsx';
import { PermissionsPanel } from './PermissionsPanel.tsx';

type Tab = 'lista' | 'permisos';

// Mismo patrón de pestañas que Logs (Auditoría/Intentos fallidos) — "Usuarios"
// pasa a ser esta página con dos vistas: la lista de siempre, y "Permisos"
// como sub-sección dedicada (ver PermissionsPanel).
export function UsersPage() {
  const [tab, setTab] = useState<Tab>('lista');

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-semibold">Usuarios</h1>
      <p className="mb-4 text-sm text-gray-500">Gestioná las cuentas de la plataforma y sus permisos.</p>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('lista')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab === 'lista' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab('permisos')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab === 'permisos'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          Permisos
        </button>
      </div>

      {tab === 'lista' ? <UserList /> : <PermissionsPanel />}
    </div>
  );
}
