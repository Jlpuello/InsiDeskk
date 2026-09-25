import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { userApi } from '../api/user.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import { permissionsForRole } from '../../../shared/security/permissions.ts';
import type { UserRole, UserSummary } from '../types/user.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';
const NIVELES = [1, 2, 3];

// A un técnico nuevo se le prenden sus 5 permisos por defecto (el admin puede
// destildar antes de crear) — sin esto, la cuenta nace "rota": no puede ver
// Inventario ni Cotizaciones ni conectarse a nada hasta que alguien entre a
// Usuarios → Permisos a habilitarlo a mano. Un cliente nuevo, en cambio, nace
// sin nada extra — aprobar cotizaciones o exportar documentos son
// capacidades puntuales que tiene sentido otorgar caso por caso.
function defaultPermisos(rol: UserRole): string[] {
  return rol === 'tecnico' ? permissionsForRole('tecnico').map((p) => p.key) : [];
}

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: (user: UserSummary) => void;
}

export function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<UserRole>('cliente');
  const [empresaId, setEmpresaId] = useState('');
  const [nivel, setNivel] = useState('');
  const [permisos, setPermisos] = useState<string[]>(defaultPermisos('cliente'));
  const [companies, setCompanies] = useState<Company[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    companyApi.list().then(setCompanies).catch(() => setCompanies([]));
  }, []);

  function handleRolChange(next: UserRole) {
    setRol(next);
    setPermisos(defaultPermisos(next));
    if (next === 'admin') setEmpresaId('');
  }

  function togglePermiso(key: string, checked: boolean) {
    setPermisos((prev) => (checked ? [...prev, key] : prev.filter((p) => p !== key)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rol !== 'admin' && !empresaId) {
      setError('Elegí una empresa');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const user = await userApi.create({
        nombre,
        apellido: apellido || undefined,
        email,
        password,
        rol,
        empresaId: empresaId || undefined,
        nivel: rol === 'tecnico' && nivel ? Number(nivel) : null,
        permisos,
      });
      onCreated(user);
    } catch {
      setError('No se pudo crear el usuario — revisá que el email no esté ya registrado y que la contraseña cumpla los requisitos (8+ caracteres, mayúscula, minúscula, número y símbolo)');
      setSaving(false);
    }
  }

  const catalog = rol === 'admin' ? [] : permissionsForRole(rol);

  return (
    <Modal title="Nuevo usuario" subtitle="Alta manual — no hay flujo de invitación por email todavía" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Nombre</label>
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Apellido</label>
            <input type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClasses} />
        </div>

        <div>
          <label className={labelClasses}>Contraseña temporal</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="off"
            className={inputClasses}
          />
          <p className="mt-1 text-xs text-gray-400">
            Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo — compartisela al usuario por fuera del
            sistema, no hay email de bienvenida todavía.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Rol</label>
            <select value={rol} onChange={(e) => handleRolChange(e.target.value as UserRole)} className={inputClasses}>
              <option value="cliente">Cliente</option>
              <option value="tecnico">Técnico</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {rol !== 'admin' && (
            <div>
              <label className={labelClasses}>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={inputClasses}>
                <option value="">Elegí una empresa</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {rol === 'tecnico' && (
          <div>
            <label className={labelClasses}>Nivel</label>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)} className={inputClasses}>
              <option value="">Sin nivel</option>
              {NIVELES.map((n) => (
                <option key={n} value={n}>
                  Nivel {n}
                </option>
              ))}
            </select>
          </div>
        )}

        {catalog.length > 0 && (
          <div className="space-y-2">
            <label className={labelClasses}>Permisos</label>
            {catalog.map((perm) => (
              <label key={perm.key} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={permisos.includes(perm.key)}
                  onChange={(e) => togglePermiso(perm.key, e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span>
                  <span className="block text-sm text-gray-900">{perm.label}</span>
                  <span className="block text-xs text-gray-400">{perm.description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
