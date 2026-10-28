import { useEffect, useMemo, useState } from 'react';
import { Plus, ShieldOff, Trash2, UserCog } from 'lucide-react';
import clsx from 'clsx';
import { userApi } from '../api/user.api.ts';
import type { UserRole, UserSummary } from '../types/user.types.ts';
import { ChangeRoleModal } from './ChangeRoleModal.tsx';
import { CreateUserModal } from './CreateUserModal.tsx';
import { permissionsForRole } from '../../../shared/security/permissions.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
import { Toggle } from '../../../shared/components/Toggle.tsx';

const ROLE_LABELS: Record<UserRole, string> = { admin: 'Admin', tecnico: 'Técnico', cliente: 'Cliente' };
// Mismo mapa de color para la insignia de rol y el círculo de inicial del
// avatar — misma identidad visual (ver CompaniesPage para el equivalente).
const ROLE_BADGE: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-700',
  tecnico: 'bg-blue-100 text-blue-700',
  cliente: 'bg-gray-100 text-gray-700',
};
const NIVELES = [1, 2, 3];

function permisosSummary(user: UserSummary): string {
  if (user.rol === 'admin') return '—';
  const catalog = permissionsForRole(user.rol);
  const granted = catalog.filter((p) => user.permisos.includes(p.key));
  return granted.length > 0 ? granted.map((p) => p.label).join(', ') : 'Sin permisos';
}

export function UserList() {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [roleTarget, setRoleTarget] = useState<UserSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserSummary | null>(null);
  const [twoFactorResetTarget, setTwoFactorResetTarget] = useState<UserSummary | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [rolFilter, setRolFilter] = useState<'all' | UserRole>('all');
  const [empresaFilter, setEmpresaFilter] = useState('all');
  const [activoFilter, setActivoFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  function load() {
    return userApi.list().then(setUsers);
  }

  useEffect(() => {
    load()
      .catch(() => setError('No se pudieron cargar los usuarios'))
      .finally(() => setLoading(false));
  }, []);

  // Se arma a partir de los propios usuarios cargados (admin ve todos, sin
  // filtro) en vez de pegarle a /companies aparte — evita otra llamada y otro
  // estado de carga solo para poblar un <select>.
  const empresas = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      if (u.empresaId && u.empresaNombre) map.set(u.empresaId, u.empresaNombre);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (rolFilter !== 'all' && u.rol !== rolFilter) return false;
      if (empresaFilter !== 'all' && u.empresaId !== empresaFilter) return false;
      if (activoFilter === 'active' && !u.activo) return false;
      if (activoFilter === 'inactive' && u.activo) return false;
      if (q && !u.nombre.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, rolFilter, empresaFilter, activoFilter, search]);

  async function withSaving(id: string, action: () => Promise<unknown>, errorMessage: string) {
    setSavingId(id);
    setError(null);
    try {
      await action();
      await load();
    } catch {
      setError(errorMessage);
    } finally {
      setSavingId(null);
    }
  }

  function handleToggleActivo(user: UserSummary) {
    return withSaving(
      user.id,
      () => userApi.update(user.id, { activo: !user.activo }),
      'No se pudo actualizar el usuario',
    );
  }

  function handleNivelChange(user: UserSummary, nivel: number | null) {
    return withSaving(user.id, () => userApi.update(user.id, { nivel }), 'No se pudo actualizar el nivel');
  }

  async function handleRoleChange(rol: UserRole, motivo: string) {
    if (!roleTarget) return;
    await userApi.update(roleTarget.id, { rol, motivo });
    setRoleTarget(null);
    await load();
  }

  async function handleDeleteUser(motivo: string) {
    if (!deleteTarget) return;
    await userApi.remove(deleteTarget.id, motivo);
    setDeleteTarget(null);
    await load();
  }

  async function handleResetTwoFactor(motivo: string) {
    if (!twoFactorResetTarget) return;
    await userApi.resetTwoFactor(twoFactorResetTarget.id, motivo);
    setTwoFactorResetTarget(null);
    await load();
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando usuarios...</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Todos los usuarios de la plataforma: admins, técnicos y clientes de cualquier empresa.
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo usuario
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <select
          value={rolFilter}
          onChange={(e) => setRolFilter(e.target.value as 'all' | UserRole)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Todos los roles</option>
          <option value="admin">Admin</option>
          <option value="tecnico">Técnico</option>
          <option value="cliente">Cliente</option>
        </select>
        <select
          value={empresaFilter}
          onChange={(e) => setEmpresaFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Todas las empresas</option>
          {empresas.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <select
          value={activoFilter}
          onChange={(e) => setActivoFilter(e.target.value as 'all' | 'active' | 'inactive')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {filtered.length === 0 ? (
        <p className="text-gray-500">No hay usuarios que coincidan con el filtro.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Usuario</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Rol</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Empresa</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Detalles</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => (
                <tr key={user.id} className={clsx('transition-colors hover:bg-gray-50', !user.activo && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                          ROLE_BADGE[user.rol],
                        )}
                      >
                        {user.nombre.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{user.nombre}</p>
                        <p className="truncate text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.rol]}`}>
                      {ROLE_LABELS[user.rol]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{user.empresaNombre ?? '—'}</td>
                  <td className="px-4 py-3">
                    {user.rol === 'tecnico' ? (
                      <select
                        value={user.nivel ?? ''}
                        onChange={(e) =>
                          handleNivelChange(user, e.target.value ? Number(e.target.value) : null)
                        }
                        disabled={savingId === user.id}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:opacity-50"
                      >
                        <option value="">Sin nivel</option>
                        {NIVELES.map((n) => (
                          <option key={n} value={n}>
                            Nivel {n}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-gray-500">{permisosSummary(user)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={user.activo}
                        disabled={savingId === user.id}
                        label={user.activo ? `Desactivar ${user.nombre}` : `Activar ${user.nombre}`}
                        onChange={() => handleToggleActivo(user)}
                      />
                      <span className={clsx('text-xs font-medium', user.activo ? 'text-green-700' : 'text-gray-500')}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setRoleTarget(user)}
                        disabled={savingId === user.id}
                        aria-label={`Cambiar rol de ${user.nombre}`}
                        title="Cambiar rol"
                        className="rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50"
                      >
                        <UserCog size={16} />
                      </button>
                      {user.twoFactorEnabled && (
                        <button
                          onClick={() => setTwoFactorResetTarget(user)}
                          disabled={savingId === user.id}
                          aria-label={`Resetear 2FA de ${user.nombre}`}
                          title="Resetear verificación en dos pasos (si quedó bloqueado)"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                        >
                          <ShieldOff size={16} />
                        </button>
                      )}
                      {user.id !== currentUserId && (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          disabled={savingId === user.id}
                          aria-label={`Eliminar ${user.nombre}`}
                          title="Eliminar"
                          className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roleTarget && (
        <ChangeRoleModal user={roleTarget} onClose={() => setRoleTarget(null)} onConfirm={handleRoleChange} />
      )}
      {deleteTarget && (
        <MotivoModal
          title="Eliminar usuario"
          subtitle={`${deleteTarget.nombre} · ${deleteTarget.email}`}
          confirmLabel="Eliminar"
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteUser}
        />
      )}
      {twoFactorResetTarget && (
        <MotivoModal
          title="Resetear verificación en dos pasos"
          subtitle={`${twoFactorResetTarget.nombre} · ${twoFactorResetTarget.email} — útil si perdió el acceso a su app autenticadora y no tiene códigos de respaldo`}
          confirmLabel="Resetear 2FA"
          confirmClassName="bg-amber-600 hover:bg-amber-700"
          onClose={() => setTwoFactorResetTarget(null)}
          onConfirm={handleResetTwoFactor}
        />
      )}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
