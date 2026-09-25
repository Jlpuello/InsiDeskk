import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { SignaturePad } from '../../../shared/components/SignaturePad.tsx';
import type { Quote } from '../types/quote.types.ts';

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
  expirado: 'Expirada',
};

function formatMoney(value: string): string {
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface QuoteResolutionFormProps {
  quote: Quote;
  // Ambos ya vienen con la identidad resuelta del lado del que llama (según
  // el canal — token o sesión logueada, ver PublicQuoteApproval/
  // PendingApprovalsPage) — este componente solo arma el formulario, no le
  // importa cómo se llega hasta acá.
  onApprove: (firmaNombre: string, firma: Blob) => Promise<void>;
  onReject: (nombre: string, motivo: string) => Promise<void>;
  ticketTitulo?: string;
}

type Mode = 'view' | 'approve' | 'reject';

// Reusado por el canal público (sin login, página completa) y por el canal
// logueado ("Aprobaciones pendientes", dentro de un Modal) — ver ambos
// componentes. Muestra el detalle económico y, si la cotización sigue
// pendiente, las dos acciones posibles.
export function QuoteResolutionForm({ quote, onApprove, onReject, ticketTitulo }: QuoteResolutionFormProps) {
  const [mode, setMode] = useState<Mode>('view');
  const [nombre, setNombre] = useState('');
  const [motivo, setMotivo] = useState('');
  const [firma, setFirma] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isPending = quote.estado === 'pendiente_aprobacion';

  async function handleApprove() {
    if (nombre.trim().length < 2 || !firma) {
      setError('Completá tu nombre y la firma dibujada');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onApprove(nombre.trim(), firma);
    } catch {
      setError('No se pudo registrar la aprobación');
      setSaving(false);
    }
  }

  async function handleReject() {
    if (nombre.trim().length < 2 || motivo.trim().length < 3) {
      setError('Completá tu nombre y el motivo del rechazo');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onReject(nombre.trim(), motivo.trim());
    } catch {
      setError('No se pudo registrar el rechazo');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {ticketTitulo && <p className="text-xs text-gray-400">Ticket: {ticketTitulo}</p>}
          <p className="text-sm font-medium text-gray-900">{quote.empresa?.nombre}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {ESTADO_LABELS[quote.estado] ?? quote.estado}
        </span>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium uppercase text-gray-400">Razón</p>
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{quote.razon}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-2 py-1.5">Concepto</th>
              <th className="px-2 py-1.5">Cantidad</th>
              <th className="px-2 py-1.5">Valor unit.</th>
              <th className="px-2 py-1.5">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {quote.lineas.map((l) => (
              <tr key={l.id}>
                <td className="px-2 py-1.5">{l.concepto}</td>
                <td className="px-2 py-1.5">{l.cantidad}</td>
                <td className="px-2 py-1.5">{formatMoney(l.valorUnitario)}</td>
                <td className="px-2 py-1.5">{formatMoney(l.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <dl className="w-56 space-y-1 text-sm">
          <div className="flex justify-between text-gray-500">
            <dt>Subtotal</dt>
            <dd>{formatMoney(quote.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-gray-500">
            <dt>Impuestos</dt>
            <dd>{formatMoney(quote.impuestos)}</dd>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold text-gray-900">
            <dt>Total</dt>
            <dd>{formatMoney(quote.total)}</dd>
          </div>
        </dl>
      </div>

      {!isPending && quote.estado === 'aprobado' && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          Aprobada por {quote.resueltoNombre} el {new Date(quote.resueltoEn ?? '').toLocaleString('es-ES')}.
        </p>
      )}
      {!isPending && quote.estado === 'rechazado' && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          Rechazada por {quote.resueltoNombre} — {quote.motivoRechazo}
        </p>
      )}
      {!isPending && quote.estado === 'expirado' && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          El link de aprobación venció sin que nadie respondiera.
        </p>
      )}

      {isPending && mode === 'view' && (
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            onClick={() => setMode('reject')}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <XCircle size={16} />
            Rechazar
          </button>
          <button
            onClick={() => setMode('approve')}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <CheckCircle2 size={16} />
            Aprobar
          </button>
        </div>
      )}

      {isPending && mode === 'approve' && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tu nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Firma</label>
            <SignaturePad onChange={setFirma} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={saving || nombre.trim().length < 2 || !firma}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Confirmar aprobación'}
            </button>
          </div>
        </div>
      )}

      {isPending && mode === 'reject' && (
        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tu nombre completo</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              minLength={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Motivo del rechazo</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              required
              minLength={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMode('view')}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={saving || nombre.trim().length < 2 || motivo.trim().length < 3}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Enviando...' : 'Confirmar rechazo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
