import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { ticketApi } from '../../tickets/api/ticket.api.ts';
import type { SlaPolicy, TicketCriticidad, TicketPriority } from '../../tickets/types/ticket.types.ts';

const LEVELS: (TicketPriority | TicketCriticidad)[] = ['baja', 'media', 'alta', 'critica'];
const LABELS: Record<string, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };

function minutesToHoursLabel(min: number): string {
  if (min < 60) return `${min}m`;
  const hours = min / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function SlaMatrixSection() {
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<{ prioridad: TicketPriority; criticidad: TicketCriticidad } | null>(null);
  const [respuestaHoras, setRespuestaHoras] = useState('');
  const [resolucionHoras, setResolucionHoras] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ticketApi
      .listSla()
      .then(setPolicies)
      .catch(() => setError('No se pudo cargar la matriz de SLA'))
      .finally(() => setLoading(false));
  }, []);

  function findPolicy(prioridad: string, criticidad: string) {
    return policies.find((p) => p.prioridad === prioridad && p.criticidad === criticidad);
  }

  function openEdit(prioridad: TicketPriority, criticidad: TicketCriticidad) {
    const policy = findPolicy(prioridad, criticidad);
    setEditing({ prioridad, criticidad });
    setRespuestaHoras(policy ? String(policy.tiempoRespuestaMin / 60) : '');
    setResolucionHoras(policy ? String(policy.tiempoResolucionMin / 60) : '');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;

    const tiempoRespuestaMin = Math.round(Number(respuestaHoras) * 60);
    const tiempoResolucionMin = Math.round(Number(resolucionHoras) * 60);
    if (!(tiempoRespuestaMin > 0) || !(tiempoResolucionMin > 0)) {
      setError('Los tiempos deben ser mayores a 0');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await ticketApi.updateSla(editing.prioridad, editing.criticidad, {
        tiempoRespuestaMin,
        tiempoResolucionMin,
      });
      setPolicies((prev) => [
        ...prev.filter((p) => !(p.prioridad === updated.prioridad && p.criticidad === updated.criticidad)),
        updated,
      ]);
      setEditing(null);
    } catch {
      setError('No se pudo guardar el SLA');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando matriz de SLA...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Matriz de SLA</h2>
      <p className="mb-4 text-xs text-gray-400">
        Tiempo de primera respuesta y de resolución para cada combinación de Prioridad × Criticidad. Se calcula al
        crear el ticket — cambiar un valor acá no afecta tickets ya creados. Click en una celda para editarla.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-center text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="py-1 text-left">Prioridad \ Criticidad</th>
              {LEVELS.map((c) => (
                <th key={c} className="py-1">
                  {LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {LEVELS.map((prioridad) => (
              <tr key={prioridad}>
                <td className="py-1.5 text-left font-medium text-gray-800">{LABELS[prioridad]}</td>
                {LEVELS.map((criticidad) => {
                  const policy = findPolicy(prioridad, criticidad);
                  return (
                    <td key={criticidad} className="py-1.5">
                      <button
                        onClick={() => openEdit(prioridad as TicketPriority, criticidad as TicketCriticidad)}
                        className="w-full rounded-md border border-transparent px-2 py-1 hover:border-gray-300 hover:bg-gray-50"
                      >
                        {policy ? (
                          <>
                            <div className="text-gray-800">{minutesToHoursLabel(policy.tiempoRespuestaMin)}</div>
                            <div className="text-gray-400">{minutesToHoursLabel(policy.tiempoResolucionMin)}</div>
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-400">Arriba: tiempo de respuesta · Abajo: tiempo de resolución</p>

      {editing && (
        <Modal
          title={`SLA: ${LABELS[editing.prioridad]} / ${LABELS[editing.criticidad]}`}
          subtitle="Prioridad / Criticidad"
          onClose={() => setEditing(null)}
          size="sm"
        >
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tiempo de primera respuesta (horas)
              </label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={respuestaHoras}
                onChange={(e) => setRespuestaHoras(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tiempo de resolución (horas)</label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={resolucionHoras}
                onChange={(e) => setResolucionHoras(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
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
    </div>
  );
}
