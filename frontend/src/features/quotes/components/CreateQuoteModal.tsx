import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { quoteApi } from '../api/quote.api.ts';
import type { Quote, QuoteLineItemInput } from '../types/quote.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none';

interface DraftLine {
  concepto: string;
  cantidad: string;
  valorUnitario: string;
  porcentajeImpuesto: string;
}

const EMPTY_LINE: DraftLine = { concepto: '', cantidad: '1', valorUnitario: '', porcentajeImpuesto: '0' };

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Mismo cálculo que QuoteService en el backend (base = cantidad*valorUnitario,
// impuesto sobre esa base) — solo para mostrar un total en vivo mientras se
// arma la cotización; el backend vuelve a calcular todo al guardar, esto no
// es la fuente de verdad.
function computeTotals(lineas: DraftLine[]) {
  let subtotal = 0;
  let impuestos = 0;
  for (const l of lineas) {
    const base = toNumber(l.cantidad) * toNumber(l.valorUnitario);
    subtotal += base;
    impuestos += base * (toNumber(l.porcentajeImpuesto) / 100);
  }
  return { subtotal, impuestos, total: subtotal + impuestos };
}

function formatMoney(value: number): string {
  return value.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CreateQuoteModalProps {
  ticketId: string;
  empresaId: string;
  onClose: () => void;
  onCreated: (quote: Quote) => void;
}

export function CreateQuoteModal({ ticketId, empresaId, onClose, onCreated }: CreateQuoteModalProps) {
  const [razon, setRazon] = useState('');
  const [lineas, setLineas] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const totals = computeTotals(lineas);
  const canSubmit =
    razon.trim().length >= 3 &&
    lineas.length > 0 &&
    lineas.every((l) => l.concepto.trim().length >= 2 && toNumber(l.cantidad) > 0 && toNumber(l.valorUnitario) >= 0);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLineas((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLineas((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);
    try {
      const lineasInput: QuoteLineItemInput[] = lineas.map((l) => ({
        concepto: l.concepto.trim(),
        cantidad: toNumber(l.cantidad),
        valorUnitario: toNumber(l.valorUnitario),
        porcentajeImpuesto: toNumber(l.porcentajeImpuesto),
      }));
      const quote = await quoteApi.create({ ticketId, empresaId, razon: razon.trim(), lineas: lineasInput });
      onCreated(quote);
    } catch {
      setError('No se pudo crear la cotización');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Nueva cotización"
      subtitle="Compra de insumos, servicios o cambio que requiere autorización del cliente"
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Razón / descripción técnica</label>
          <textarea
            value={razon}
            onChange={(e) => setRazon(e.target.value)}
            rows={3}
            required
            minLength={3}
            placeholder="Ej: Se detectó falla en el disco SSD, se requiere reemplazo..."
            className={inputClasses}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Líneas</label>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
            >
              <Plus size={14} />
              Agregar línea
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-2 py-1.5">Concepto</th>
                  <th className="px-2 py-1.5">Cantidad</th>
                  <th className="px-2 py-1.5">Valor unit.</th>
                  <th className="px-2 py-1.5">Imp. %</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lineas.map((linea, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={linea.concepto}
                        onChange={(e) => updateLine(i, { concepto: e.target.value })}
                        placeholder="Ej: Disco SSD 480GB"
                        className={inputClasses}
                      />
                    </td>
                    <td className="px-2 py-1.5 w-24">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={linea.cantidad}
                        onChange={(e) => updateLine(i, { cantidad: e.target.value })}
                        className={inputClasses}
                      />
                    </td>
                    <td className="px-2 py-1.5 w-32">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={linea.valorUnitario}
                        onChange={(e) => updateLine(i, { valorUnitario: e.target.value })}
                        className={inputClasses}
                      />
                    </td>
                    <td className="px-2 py-1.5 w-20">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={linea.porcentajeImpuesto}
                        onChange={(e) => updateLine(i, { porcentajeImpuesto: e.target.value })}
                        className={inputClasses}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lineas.length === 1}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <dl className="w-56 space-y-1 text-sm">
            <div className="flex justify-between text-gray-500">
              <dt>Subtotal</dt>
              <dd>{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-gray-500">
              <dt>Impuestos</dt>
              <dd>{formatMoney(totals.impuestos)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900">
              <dt>Total</dt>
              <dd>{formatMoney(totals.total)}</dd>
            </div>
          </dl>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar borrador'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
