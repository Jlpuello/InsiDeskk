import { useEffect, useState } from 'react';
import { ticketApi } from '../../tickets/api/ticket.api.ts';
import { Toggle } from '../../../shared/components/Toggle.tsx';
import type { TicketLevelVisibility } from '../../tickets/types/ticket.types.ts';

const NIVELES = [1, 2, 3];

// Matriz booleana simple (a diferencia de SlaMatrixSection, no hace falta un
// modal por celda — togglear ya es la acción completa). Una fila ausente en
// `rows` significa "visible" (ver TicketLevelVisibilityService en el
// backend), así que isVisible() no puede asumir que todo vino del server.
export function TicketLevelVisibilitySection() {
  const [rows, setRows] = useState<TicketLevelVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    ticketApi
      .listNivelVisibility()
      .then(setRows)
      .catch(() => setError('No se pudo cargar la matriz de visibilidad'))
      .finally(() => setLoading(false));
  }, []);

  function isVisible(nivelTecnico: number, nivelTicket: number): boolean {
    const row = rows.find((r) => r.nivelTecnico === nivelTecnico && r.nivelTicket === nivelTicket);
    return row ? row.visible : true;
  }

  async function handleToggle(nivelTecnico: number, nivelTicket: number) {
    const key = `${nivelTecnico}-${nivelTicket}`;
    const next = !isVisible(nivelTecnico, nivelTicket);

    setSavingKey(key);
    setError(null);
    try {
      const updated = await ticketApi.updateNivelVisibility(nivelTecnico, nivelTicket, next);
      setRows((prev) => [
        ...prev.filter((r) => !(r.nivelTecnico === nivelTecnico && r.nivelTicket === nivelTicket)),
        updated,
      ]);
    } catch {
      setError('No se pudo actualizar la visibilidad');
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Cargando matriz de visibilidad...</p>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Visibilidad de tickets por nivel</h2>
      <p className="mb-4 text-xs text-gray-400">
        Qué niveles de ticket puede ver cada nivel de técnico al navegar la lista general de tickets. Un técnico
        siempre ve los tickets ya asignados a él, sin importar esto — solo afecta lo que puede descubrir navegando.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-center text-xs">
          <thead className="text-gray-400">
            <tr>
              <th className="py-1 text-left">Técnico \ Ticket</th>
              {NIVELES.map((n) => (
                <th key={n} className="py-1">
                  Nivel {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {NIVELES.map((nivelTecnico) => (
              <tr key={nivelTecnico}>
                <td className="py-2 text-left font-medium text-gray-800">Nivel {nivelTecnico}</td>
                {NIVELES.map((nivelTicket) => {
                  const key = `${nivelTecnico}-${nivelTicket}`;
                  return (
                    <td key={nivelTicket} className="py-2">
                      <Toggle
                        checked={isVisible(nivelTecnico, nivelTicket)}
                        disabled={savingKey === key}
                        label={`Técnico nivel ${nivelTecnico} ve tickets nivel ${nivelTicket}`}
                        onChange={() => handleToggle(nivelTecnico, nivelTicket)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
