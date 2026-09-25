import { useEffect, useMemo, useState } from 'react';
import { userApi } from '../api/user.api.ts';
import { permissionsForRole, type Permission } from '../../../shared/security/permissions.ts';
import { Toggle } from '../../../shared/components/Toggle.tsx';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
import type { UserSummary } from '../types/user.types.ts';

interface PendingChange {
  user: UserSummary;
  permission: Permission;
  label: string;
  // true = se está otorgando, false = se está quitando — decide el texto y
  // el color del MotivoModal.
  next: boolean;
}

interface CatalogEntry {
  key: Permission;
  label: string;
  description: string;
}

// Una tabla de usuarios × permisos por grupo (nivel de técnico, o clientes) —
// se omite entera si el grupo no tiene usuarios, en vez de mostrar una
// sección vacía.
function PermisosTable({
  title,
  users,
  catalog,
  onToggle,
}: {
  title: string;
  users: UserSummary[];
  catalog: CatalogEntry[];
  onToggle: (user: UserSummary, perm: CatalogEntry) => void;
}) {
  if (users.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</h3>
      <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Usuario</th>
              {catalog.map((perm) => (
                <th
                  key={perm.key}
                  title={perm.description}
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {perm.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                      {user.nombre.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900">{user.nombre}</p>
                      <p className="truncate text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                </td>
                {catalog.map((perm) => (
                  <td key={perm.key} className="px-4 py-3">
                    <Toggle
                      checked={user.permisos.includes(perm.key)}
                      label={`${perm.label} para ${user.nombre}`}
                      onChange={() => onToggle(user, perm)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Sub-sección de Usuarios (pestaña "Permisos"): reemplaza al viejo botón de
// llave que abría un modal con checkboxes de TODOS los permisos de un
// usuario a la vez — acá cada capacidad es un Toggle en su propia celda,
// agrupado por rol (y, dentro de técnico, por nivel 1/2/3) para verlas y
// compararlas de un vistazo entre usuarios. El backend igual exige motivo en
// cada cambio (acción crítica auditada — ver UserController.updateSchema),
// así que togglear abre un MotivoModal acotado a ESE único permiso, no un
// formulario con toda la lista.
export function PermissionsPanel() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);

  function load() {
    return userApi.list().then(setUsers);
  }

  useEffect(() => {
    load()
      .catch(() => setError('No se pudieron cargar los usuarios'))
      .finally(() => setLoading(false));
  }, []);

  const tecnicoCatalog = permissionsForRole('tecnico');
  const clienteCatalog = permissionsForRole('cliente');

  const tecnicosPorNivel = useMemo(() => {
    const groups = new Map<number, UserSummary[]>();
    const sinNivel: UserSummary[] = [];
    users
      .filter((u) => u.rol === 'tecnico')
      .forEach((u) => {
        if (!u.nivel) {
          sinNivel.push(u);
          return;
        }
        if (!groups.has(u.nivel)) groups.set(u.nivel, []);
        groups.get(u.nivel)!.push(u);
      });
    return { groups, sinNivel };
  }, [users]);

  const clientes = useMemo(() => users.filter((u) => u.rol === 'cliente'), [users]);
  const tieneTecnicos = users.some((u) => u.rol === 'tecnico');

  function requestToggle(user: UserSummary, perm: CatalogEntry) {
    setPending({ user, permission: perm.key, label: perm.label, next: !user.permisos.includes(perm.key) });
  }

  async function handleConfirm(motivo: string) {
    if (!pending) return;
    const { user, permission, next } = pending;
    const permisos = next ? [...user.permisos, permission] : user.permisos.filter((p) => p !== permission);
    await userApi.update(user.id, { permisos, motivo });
    setPending(null);
    await load();
  }

  if (loading) return <p className="text-gray-500">Cargando usuarios...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <p className="mb-5 text-sm text-gray-500">
        Capacidades puntuales además del rol base de cada usuario — activalas o desactivalas con el switch. Todo
        cambio queda auditado y pide un motivo.
      </p>

      <h2 className="mb-3 text-base font-semibold text-gray-900">Técnicos</h2>
      {tieneTecnicos ? (
        <>
          {[1, 2, 3].map((nivel) => (
            <PermisosTable
              key={nivel}
              title={`Nivel ${nivel}`}
              users={tecnicosPorNivel.groups.get(nivel) ?? []}
              catalog={tecnicoCatalog}
              onToggle={requestToggle}
            />
          ))}
          <PermisosTable
            title="Sin nivel asignado"
            users={tecnicosPorNivel.sinNivel}
            catalog={tecnicoCatalog}
            onToggle={requestToggle}
          />
        </>
      ) : (
        <p className="mb-5 text-sm text-gray-400">No hay técnicos registrados.</p>
      )}

      <h2 className="mb-3 mt-6 text-base font-semibold text-gray-900">Clientes</h2>
      {clientes.length > 0 ? (
        <PermisosTable title="Aprobadores y accesos" users={clientes} catalog={clienteCatalog} onToggle={requestToggle} />
      ) : (
        <p className="text-sm text-gray-400">No hay clientes registrados.</p>
      )}

      {pending && (
        <MotivoModal
          title={pending.next ? 'Otorgar permiso' : 'Quitar permiso'}
          subtitle={`${pending.label} · ${pending.user.nombre}`}
          confirmLabel={pending.next ? 'Otorgar' : 'Quitar'}
          confirmClassName={pending.next ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
          onClose={() => setPending(null)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
