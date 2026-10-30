import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Boxes, Building2, Pencil, ShieldAlert } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
import { Toggle } from '../../../shared/components/Toggle.tsx';
import { companyApi } from '../api/company.api.ts';
import { remotelyApi } from '../../remotely/api/remotely.api.ts';
import type { Company, CompanyFormInput } from '../types/company.types.ts';
import type { RemotelyDeviceGroup } from '../../remotely/types/remotely.types.ts';

const EMPTY_FORM: CompanyFormInput = {
  nombre: '',
  razonSocial: '',
  nit: '',
  emailContacto: '',
  telefono: '',
  direccion: '',
  ciudad: '',
  pais: '',
  contrato: '',
  remotelyGroupId: '',
  glpiAgentTag: '',
};

export function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<RemotelyDeviceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState<CompanyFormInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState<Company | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  // Autogeneradas por la landing pública cuando el NIT no existía todavía
  // (ver companyService.resolveOrProvisionByNit) — filtro rápido para que el
  // equipo las encuentre y las revise/complete.
  const [onlyPending, setOnlyPending] = useState(false);

  function loadCompanies() {
    return companyApi.list().then(setCompanies);
  }

  useEffect(() => {
    Promise.all([
      loadCompanies(),
      // Los grupos son opcionales del lado de Remotely: si el servidor no
      // está configurado o falla, la página de empresas igual debe cargar
      // (el selector de grupo simplemente queda vacío).
      remotelyApi.listGroups().catch(() => []),
    ])
      .then(([, groupsData]) => setGroups(groupsData))
      .catch(() => setError('No se pudieron cargar las empresas'))
      .finally(() => setLoading(false));
  }, []);

  const groupName = (id?: string | null) => groups.find((g) => g.id === id)?.name;

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(company: Company) {
    setEditing(company);
    setForm({
      nombre: company.nombre,
      razonSocial: company.razonSocial ?? '',
      nit: company.nit ?? '',
      emailContacto: company.emailContacto ?? '',
      telefono: company.telefono ?? '',
      direccion: company.direccion ?? '',
      ciudad: company.ciudad ?? '',
      pais: company.pais ?? '',
      contrato: company.contrato ?? '',
      remotelyGroupId: company.remotelyGroupId ?? '',
      glpiAgentTag: company.glpiAgentTag ?? '',
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const input: CompanyFormInput = {
        ...form,
        remotelyGroupId: form.remotelyGroupId || null,
        glpiAgentTag: form.glpiAgentTag || null,
      };
      if (editing) {
        await companyApi.update(editing.id, input);
      } else {
        await companyApi.create(input);
      }
      await loadCompanies();
      setShowForm(false);
    } catch {
      setFormError('No se pudo guardar la empresa. Verificá que el nombre no esté repetido.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(motivo: string) {
    if (!deactivating) return;
    await companyApi.deactivate(deactivating.id, motivo);
    setDeactivating(null);
    await loadCompanies();
  }

  async function handleReactivate(company: Company) {
    setTogglingId(company.id);
    try {
      await companyApi.reactivate(company.id);
      await loadCompanies();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleMarkVerified(company: Company) {
    setVerifyingId(company.id);
    try {
      await companyApi.markVerified(company.id);
      await loadCompanies();
    } finally {
      setVerifyingId(null);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando empresas...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  const pendingCount = companies.filter((c) => !c.verificado).length;
  const visibleCompanies = onlyPending ? companies.filter((c) => !c.verificado) : companies;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Empresas</h1>
          <p className="text-sm text-gray-500">
            Mapeá cada empresa a un grupo de Remotely para que sus equipos se den de alta y actualicen solos.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nueva empresa
        </button>
      </div>

      {pendingCount > 0 && (
        <button
          onClick={() => setOnlyPending((v) => !v)}
          className={clsx(
            'mb-4 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            onlyPending ? 'bg-amber-600 text-white' : 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
          )}
        >
          <ShieldAlert size={13} />
          {pendingCount} pendiente{pendingCount === 1 ? '' : 's'} de verificar
        </button>
      )}

      {visibleCompanies.length === 0 ? (
        <p className="text-gray-500">
          {onlyPending ? 'No hay empresas pendientes de verificar.' : 'No hay empresas registradas todavía.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Empresa</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">NIT</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Contrato</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Grupo Remotely</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleCompanies.map((company) => (
                <tr key={company.id} className={clsx('transition-colors hover:bg-gray-50', !company.activo && 'opacity-60')}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Building2 size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium text-gray-900">{company.nombre}</p>
                          {!company.verificado && (
                            <span
                              title="Autogenerada desde la landing pública de soporte — sin revisar todavía"
                              className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                            >
                              <ShieldAlert size={10} /> Pendiente
                            </span>
                          )}
                        </div>
                        {company.razonSocial && company.razonSocial !== company.nombre && (
                          <p className="truncate text-xs text-gray-400">{company.razonSocial}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-600">{company.nit ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{company.contrato ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {company.remotelyGroupId ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {groupName(company.remotelyGroupId) ?? company.remotelyGroupId}
                        </span>
                      ) : (
                        !company.glpiAgentTag && <span className="text-gray-400">Sin mapear</span>
                      )}
                      {company.glpiAgentTag && (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                          GLPI: {company.glpiAgentTag}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Toggle
                        checked={company.activo}
                        disabled={togglingId === company.id}
                        label={company.activo ? `Desactivar ${company.nombre}` : `Reactivar ${company.nombre}`}
                        onChange={() => (company.activo ? setDeactivating(company) : handleReactivate(company))}
                      />
                      <span className={clsx('text-xs font-medium', company.activo ? 'text-green-700' : 'text-gray-500')}>
                        {company.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!company.verificado && (
                        <button
                          onClick={() => handleMarkVerified(company)}
                          disabled={verifyingId === company.id}
                          className="rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                        >
                          Marcar verificada
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(company)}
                        aria-label={`Editar ${company.nombre}`}
                        title="Editar"
                        className="inline-flex rounded-md p-1.5 text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? `Editar ${editing.nombre}` : 'Nueva empresa'}
          onClose={() => setShowForm(false)}
          size="sm"
        >
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
              <input
                type="text"
                required
                minLength={2}
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Razón social</label>
                <input
                  type="text"
                  value={form.razonSocial}
                  onChange={(e) => setForm({ ...form, razonSocial: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">NIT</label>
                <input
                  type="text"
                  value={form.nit}
                  onChange={(e) => setForm({ ...form, nit: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email de contacto</label>
                <input
                  type="email"
                  value={form.emailContacto}
                  onChange={(e) => setForm({ ...form, emailContacto: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Dirección</label>
              <input
                type="text"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ciudad</label>
                <input
                  type="text"
                  value={form.ciudad}
                  onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">País</label>
                <input
                  type="text"
                  value={form.pais}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Contrato</label>
              <input
                type="text"
                value={form.contrato}
                onChange={(e) => setForm({ ...form, contrato: e.target.value })}
                placeholder="Ej: Mensual, Anual - vence 12/2026, N° 2026-045..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Building2 className="h-4 w-4 text-gray-400" />
                Grupo de Remotely
              </label>
              <select
                value={form.remotelyGroupId ?? ''}
                onChange={(e) => setForm({ ...form, remotelyGroupId: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Ninguno</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Los equipos de este grupo en Remotely se dan de alta y reasignan a esta empresa automáticamente.
              </p>
              {groups.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  No se pudieron cargar los grupos de Remotely — verificá la configuración en Configuración.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <Boxes className="h-4 w-4 text-gray-400" />
                Tag de GLPI Agent
              </label>
              <input
                type="text"
                value={form.glpiAgentTag ?? ''}
                onChange={(e) => setForm({ ...form, glpiAgentTag: e.target.value })}
                placeholder="Ej: impormar"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-400">
                Para equipos sin Remotely (sin control remoto) que reportan inventario con GLPI Agent — instalalo con{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5">--tag={form.glpiAgentTag || '<este-valor>'}</code>.
              </p>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deactivating && (
        <MotivoModal
          title={`Desactivar "${deactivating.nombre}"`}
          subtitle="No se borran sus equipos ni tickets, solo deja de estar activa"
          confirmLabel="Desactivar"
          onClose={() => setDeactivating(null)}
          onConfirm={handleDeactivate}
        />
      )}
    </div>
  );
}
