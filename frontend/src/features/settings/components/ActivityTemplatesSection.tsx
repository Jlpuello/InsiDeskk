import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { activityApi } from '../../activities/api/activity.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import type { ActivityTemplate, ActivityType, RecurrenceType } from '../../activities/types/activity.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'integracion', label: 'Integración' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'otro', label: 'Otro' },
];

const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  mensual: 'Mensual',
};

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function describeRecurrence(t: ActivityTemplate): string {
  if (t.recurrenciaTipo === 'diaria') return 'Todos los días';
  if (t.recurrenciaTipo === 'semanal') return `Cada ${WEEKDAYS[t.recurrenciaDia ?? 0]}`;
  return `El día ${t.recurrenciaDia} de cada mes`;
}

interface Draft {
  titulo: string;
  empresaId: string;
  tipo: ActivityType;
  recurrenciaTipo: RecurrenceType;
  recurrenciaDia: string;
}

const EMPTY_DRAFT: Draft = { titulo: '', empresaId: '', tipo: 'mantenimiento', recurrenciaTipo: 'semanal', recurrenciaDia: '1' };

export function ActivityTemplatesSection() {
  const [templates, setTemplates] = useState<ActivityTemplate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return activityApi.listTemplates().then(setTemplates);
  }

  useEffect(() => {
    Promise.all([load(), companyApi.list().then(setCompanies)])
      .catch(() => setError('No se pudieron cargar las plantillas'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!draft.titulo.trim() || !draft.empresaId) return;
    setSaving(true);
    setError(null);
    try {
      await activityApi.createTemplate({
        titulo: draft.titulo.trim(),
        empresaId: draft.empresaId,
        tipo: draft.tipo,
        recurrenciaTipo: draft.recurrenciaTipo,
        recurrenciaDia: draft.recurrenciaTipo === 'diaria' ? undefined : Number(draft.recurrenciaDia),
      });
      setDraft(EMPTY_DRAFT);
      await load();
    } catch {
      setError('No se pudo crear la plantilla');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(template: ActivityTemplate) {
    await activityApi.updateTemplate(template.id, { activo: !template.activo });
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando plantillas...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Actividades recurrentes</h2>
      <p className="mb-4 text-xs text-gray-400">
        Cada plantilla genera automáticamente una nueva actividad cuando corresponde (revisado una vez al día). Útil
        para tareas que se repiten solas, como revisar backups todas las semanas.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="mb-4 space-y-2 rounded-md border border-gray-200 p-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={draft.titulo}
            onChange={(e) => setDraft((prev) => ({ ...prev, titulo: e.target.value }))}
            placeholder="Título (ej: Revisión de backups)"
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={draft.empresaId}
            onChange={(e) => setDraft((prev) => ({ ...prev, empresaId: e.target.value }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Empresa...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <select
            value={draft.tipo}
            onChange={(e) => setDraft((prev) => ({ ...prev, tipo: e.target.value as ActivityType }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            value={draft.recurrenciaTipo}
            onChange={(e) => setDraft((prev) => ({ ...prev, recurrenciaTipo: e.target.value as RecurrenceType }))}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            {(['diaria', 'semanal', 'mensual'] as RecurrenceType[]).map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABELS[r]}
              </option>
            ))}
          </select>

          {draft.recurrenciaTipo === 'semanal' && (
            <select
              value={draft.recurrenciaDia}
              onChange={(e) => setDraft((prev) => ({ ...prev, recurrenciaDia: e.target.value }))}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {WEEKDAYS.map((day, i) => (
                <option key={day} value={i}>
                  {day}
                </option>
              ))}
            </select>
          )}
          {draft.recurrenciaTipo === 'mensual' && (
            <input
              type="number"
              min={1}
              max={28}
              value={draft.recurrenciaDia}
              onChange={(e) => setDraft((prev) => ({ ...prev, recurrenciaDia: e.target.value }))}
              placeholder="Día del mes (1-28)"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={saving || !draft.titulo.trim() || !draft.empresaId}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar plantilla
        </button>
      </form>

      {templates.length === 0 ? (
        <p className="text-sm text-gray-500">Sin plantillas todavía.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {templates.map((t) => (
            <li
              key={t.id}
              className={clsx('flex flex-wrap items-center justify-between gap-2 py-2.5', !t.activo && 'opacity-50')}
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{t.titulo}</p>
                <p className="text-xs text-gray-400">
                  {t.empresa?.nombre} · {describeRecurrence(t)}
                  {t.ultimaGeneracion && ` · última generación ${new Date(t.ultimaGeneracion).toLocaleDateString('es-ES')}`}
                </p>
              </div>
              <button onClick={() => handleToggle(t)} className="text-xs text-gray-500 hover:underline">
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
