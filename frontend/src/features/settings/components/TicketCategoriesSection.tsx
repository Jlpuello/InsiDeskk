import { useEffect, useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { ticketApi } from '../../tickets/api/ticket.api.ts';
import type { TicketCategory, TicketCriticidad, TicketPriority, TicketSubcategory } from '../../tickets/types/ticket.types.ts';

const LEVELS: TicketPriority[] = ['baja', 'media', 'alta', 'critica'];
const LABELS: Record<TicketPriority, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
const NIVELES = [1, 2, 3];

interface LevelSelectProps {
  label: string;
  value: TicketPriority | TicketCriticidad | null;
  onChange: (value: TicketPriority | TicketCriticidad | null) => void;
}

function LevelSelect({ label, value, onChange }: LevelSelectProps) {
  return (
    <select
      title={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? (e.target.value as TicketPriority) : null)}
      className="rounded-md border border-gray-300 px-1.5 py-1 text-xs capitalize focus:border-blue-500 focus:outline-none"
    >
      <option value="">{label}: libre</option>
      {LEVELS.map((l) => (
        <option key={l} value={l} className="capitalize">
          {label}: {LABELS[l]}
        </option>
      ))}
    </select>
  );
}

function NivelSelect({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <select
      title="Nivel de técnico requerido"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none"
    >
      <option value="">Nivel: sin auto-asignar</option>
      {NIVELES.map((n) => (
        <option key={n} value={n}>
          Nivel {n}
        </option>
      ))}
    </select>
  );
}

interface DefaultsDraft {
  prioridadDefault: TicketPriority | null;
  criticidadDefault: TicketCriticidad | null;
  nivelRequerido: number | null;
}

const EMPTY_DEFAULTS: DefaultsDraft = { prioridadDefault: null, criticidadDefault: null, nivelRequerido: null };

export function TicketCategoriesSection() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDefaults, setNewCategoryDefaults] = useState<DefaultsDraft>(EMPTY_DEFAULTS);
  const [savingCategory, setSavingCategory] = useState(false);

  const [subcategoryDrafts, setSubcategoryDrafts] = useState<Record<string, { nombre: string } & DefaultsDraft>>({});
  const [savingSubcategoryFor, setSavingSubcategoryFor] = useState<string | null>(null);

  function load() {
    return ticketApi.listCategories().then(setCategories);
  }

  useEffect(() => {
    load()
      .catch(() => setError('No se pudieron cargar las categorías'))
      .finally(() => setLoading(false));
  }, []);

  function draftFor(categoriaId: string) {
    return subcategoryDrafts[categoriaId] ?? { nombre: '', ...EMPTY_DEFAULTS };
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setSavingCategory(true);
    try {
      await ticketApi.createCategory(newCategoryName.trim(), newCategoryDefaults);
      setNewCategoryName('');
      setNewCategoryDefaults(EMPTY_DEFAULTS);
      await load();
    } catch {
      setError('No se pudo crear la categoría (¿nombre repetido?)');
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleToggleCategory(category: TicketCategory) {
    await ticketApi.updateCategory(category.id, { activo: !category.activo });
    await load();
  }

  async function handleCategoryDefaultsChange(category: TicketCategory, patch: Partial<DefaultsDraft>) {
    await ticketApi.updateCategory(category.id, patch);
    await load();
  }

  async function handleCreateSubcategory(categoriaId: string) {
    const draft = draftFor(categoriaId);
    const nombre = draft.nombre.trim();
    if (!nombre) return;
    setSavingSubcategoryFor(categoriaId);
    try {
      await ticketApi.createSubcategory(categoriaId, nombre, {
        prioridadDefault: draft.prioridadDefault,
        criticidadDefault: draft.criticidadDefault,
        nivelRequerido: draft.nivelRequerido,
      });
      setSubcategoryDrafts((prev) => ({
        ...prev,
        [categoriaId]: { nombre: '', ...EMPTY_DEFAULTS },
      }));
      await load();
    } catch {
      setError('No se pudo crear la subcategoría (¿nombre repetido dentro de esta categoría?)');
    } finally {
      setSavingSubcategoryFor(null);
    }
  }

  async function handleToggleSubcategory(categoriaId: string, subcategoryId: string, activo: boolean) {
    await ticketApi.updateSubcategory(categoriaId, subcategoryId, { activo: !activo });
    await load();
  }

  async function handleSubcategoryDefaultsChange(
    categoriaId: string,
    subcategoryId: string,
    patch: Partial<DefaultsDraft>,
  ) {
    await ticketApi.updateSubcategory(categoriaId, subcategoryId, patch);
    await load();
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando categorías...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Categorías y subcategorías</h2>
      <p className="mb-4 text-xs text-gray-400">
        Clasifican de qué trata cada ticket. Desactivar una no borra los tickets que ya la usan, solo deja de
        ofrecerla para tickets nuevos. Si fijás Prioridad o Criticidad acá, todo ticket de esa categoría/subcategoría
        queda con ese valor sin excepción. El "Nivel" determina a qué técnico se auto-asigna un ticket nuevo de esa
        categoría (al que menos tickets abiertos tenga en ese nivel) — si no hay ningún técnico activo de ese nivel,
        queda sin asignar. En ambos casos la subcategoría gana sobre la categoría cuando las dos fijan un valor.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreateCategory} className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nueva categoría (ej: Hardware)"
          className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <LevelSelect
          label="Prioridad"
          value={newCategoryDefaults.prioridadDefault}
          onChange={(v) => setNewCategoryDefaults((prev) => ({ ...prev, prioridadDefault: v }))}
        />
        <LevelSelect
          label="Criticidad"
          value={newCategoryDefaults.criticidadDefault}
          onChange={(v) => setNewCategoryDefaults((prev) => ({ ...prev, criticidadDefault: v }))}
        />
        <NivelSelect
          value={newCategoryDefaults.nivelRequerido}
          onChange={(v) => setNewCategoryDefaults((prev) => ({ ...prev, nivelRequerido: v }))}
        />
        <button
          type="submit"
          disabled={savingCategory || !newCategoryName.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="text-sm text-gray-500">Sin categorías todavía.</p>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => {
            const draft = draftFor(category.id);
            return (
              <div
                key={category.id}
                className={clsx('rounded-md border border-gray-200 p-3', !category.activo && 'opacity-50')}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{category.nombre}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelSelect
                      label="Prioridad"
                      value={category.prioridadDefault}
                      onChange={(v) => handleCategoryDefaultsChange(category, { prioridadDefault: v })}
                    />
                    <LevelSelect
                      label="Criticidad"
                      value={category.criticidadDefault}
                      onChange={(v) => handleCategoryDefaultsChange(category, { criticidadDefault: v })}
                    />
                    <NivelSelect
                      value={category.nivelRequerido}
                      onChange={(v) => handleCategoryDefaultsChange(category, { nivelRequerido: v })}
                    />
                    <button
                      onClick={() => handleToggleCategory(category)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      {category.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>

                {(category.subcategorias?.length ?? 0) > 0 && (
                  <ul className="mb-2 space-y-1.5">
                    {category.subcategorias!.map((sub: TicketSubcategory) => (
                      <li
                        key={sub.id}
                        className={clsx(
                          'flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5',
                          !sub.activo && 'opacity-50',
                        )}
                      >
                        <span className="text-xs font-medium text-gray-700">{sub.nombre}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <LevelSelect
                            label="Prioridad"
                            value={sub.prioridadDefault}
                            onChange={(v) =>
                              handleSubcategoryDefaultsChange(category.id, sub.id, { prioridadDefault: v })
                            }
                          />
                          <LevelSelect
                            label="Criticidad"
                            value={sub.criticidadDefault}
                            onChange={(v) =>
                              handleSubcategoryDefaultsChange(category.id, sub.id, { criticidadDefault: v })
                            }
                          />
                          <NivelSelect
                            value={sub.nivelRequerido}
                            onChange={(v) => handleSubcategoryDefaultsChange(category.id, sub.id, { nivelRequerido: v })}
                          />
                          <button
                            onClick={() => handleToggleSubcategory(category.id, sub.id, sub.activo)}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            {sub.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={draft.nombre}
                    onChange={(e) =>
                      setSubcategoryDrafts((prev) => ({
                        ...prev,
                        [category.id]: { ...draft, nombre: e.target.value },
                      }))
                    }
                    placeholder="Nueva subcategoría..."
                    className="min-w-[140px] flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                  />
                  <LevelSelect
                    label="Prioridad"
                    value={draft.prioridadDefault}
                    onChange={(v) =>
                      setSubcategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, prioridadDefault: v } }))
                    }
                  />
                  <LevelSelect
                    label="Criticidad"
                    value={draft.criticidadDefault}
                    onChange={(v) =>
                      setSubcategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, criticidadDefault: v } }))
                    }
                  />
                  <NivelSelect
                    value={draft.nivelRequerido}
                    onChange={(v) =>
                      setSubcategoryDrafts((prev) => ({ ...prev, [category.id]: { ...draft, nivelRequerido: v } }))
                    }
                  />
                  <button
                    onClick={() => handleCreateSubcategory(category.id)}
                    disabled={savingSubcategoryFor === category.id || !draft.nombre.trim()}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
