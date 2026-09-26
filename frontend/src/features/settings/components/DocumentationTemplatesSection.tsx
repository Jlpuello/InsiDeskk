import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { documentationTemplateApi } from '../../documentation-templates/api/documentation-template.api.ts';
import type {
  DocumentationTemplate,
  DocumentationTemplateContext,
} from '../../documentation-templates/types/documentation-template.types.ts';

const CONTEXT_OPTIONS: { value: DocumentationTemplateContext; label: string }[] = [
  { value: 'cierre_ticket', label: 'Cierre de ticket' },
  { value: 'completar_actividad', label: 'Completar actividad' },
  { value: 'motivo_pausa', label: 'Motivo de pausa' },
];

const CONTEXT_LABELS = Object.fromEntries(CONTEXT_OPTIONS.map((o) => [o.value, o.label])) as Record<
  DocumentationTemplateContext,
  string
>;

interface Draft {
  titulo: string;
  contenido: string;
  contextos: DocumentationTemplateContext[];
}

const EMPTY_DRAFT: Draft = { titulo: '', contenido: '', contextos: [] };

export function DocumentationTemplatesSection() {
  const [templates, setTemplates] = useState<DocumentationTemplate[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return documentationTemplateApi.list().then(setTemplates);
  }

  useEffect(() => {
    load()
      .catch(() => setError('No se pudieron cargar las plantillas'))
      .finally(() => setLoading(false));
  }, []);

  function toggleContexto(value: DocumentationTemplateContext) {
    setDraft((prev) => ({
      ...prev,
      contextos: prev.contextos.includes(value)
        ? prev.contextos.filter((c) => c !== value)
        : [...prev.contextos, value],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!draft.titulo.trim() || !draft.contenido.trim() || draft.contextos.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await documentationTemplateApi.create({
        titulo: draft.titulo.trim(),
        contenido: draft.contenido.trim(),
        contextos: draft.contextos,
      });
      setDraft(EMPTY_DRAFT);
      await load();
    } catch {
      setError('No se pudo crear la plantilla');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActivo(template: DocumentationTemplate) {
    await documentationTemplateApi.update(template.id, { activo: !template.activo });
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando plantillas...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Plantillas de documentación</h2>
      <p className="mb-4 text-xs text-gray-400">
        Textos reutilizables que aparecen como opción para insertar al cerrar un ticket, completar una actividad, o
        indicar el motivo de una pausa — una misma plantilla puede aplicar a más de un caso.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="mb-4 space-y-2 rounded-md border border-gray-200 p-3">
        <input
          type="text"
          value={draft.titulo}
          onChange={(e) => setDraft((prev) => ({ ...prev, titulo: e.target.value }))}
          placeholder="Título (ej: Reinicio de equipo)"
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <textarea
          value={draft.contenido}
          onChange={(e) => setDraft((prev) => ({ ...prev, contenido: e.target.value }))}
          placeholder="Texto que se inserta al elegir esta plantilla..."
          rows={3}
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="flex flex-wrap gap-3 pt-1">
          {CONTEXT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={draft.contextos.includes(opt.value)}
                onChange={() => toggleContexto(opt.value)}
                className="rounded"
              />
              {opt.label}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={saving || !draft.titulo.trim() || !draft.contenido.trim() || draft.contextos.length === 0}
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
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{t.titulo}</p>
                <p className="truncate text-xs text-gray-400">
                  {t.contextos.map((c) => CONTEXT_LABELS[c]).join(' · ')}
                </p>
              </div>
              <button onClick={() => handleToggleActivo(t)} className="shrink-0 text-xs text-gray-500 hover:underline">
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
