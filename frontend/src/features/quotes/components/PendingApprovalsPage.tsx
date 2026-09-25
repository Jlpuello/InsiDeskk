import { useEffect, useState } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { quoteApi } from '../api/quote.api.ts';
import { QuoteResolutionForm } from './QuoteResolutionForm.tsx';
import type { Quote } from '../types/quote.types.ts';

function formatMoney(value: string): string {
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Canal logueado del híbrido — solo lista lo que ESTE usuario cliente quedó
// designado a resolver (ver Usuarios). El link por email (sin login) resuelve
// exactamente la misma cotización por otro camino, ver PublicQuoteApproval.
export function PendingApprovalsPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Quote | null>(null);

  function load() {
    setLoading(true);
    return quoteApi
      .listPendingForMe()
      .then(setQuotes)
      .catch(() => setError('No se pudieron cargar las aprobaciones pendientes'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(firmaNombre: string, firma: Blob) {
    if (!selected) return;
    await quoteApi.approve(selected.id, firmaNombre, firma);
    setSelected(null);
    load();
  }

  async function handleReject(nombre: string, motivo: string) {
    if (!selected) return;
    await quoteApi.reject(selected.id, nombre, motivo);
    setSelected(null);
    load();
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando...</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Aprobaciones pendientes</h1>

      {quotes.length === 0 ? (
        <p className="text-gray-500">No tenés cotizaciones pendientes de aprobar.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <button
              key={q.id}
              onClick={() => setSelected(q)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm hover:bg-gray-50"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{q.razon}</p>
                <p className="text-xs text-gray-400">
                  {q.empresa?.nombre} · {new Date(q.createdAt).toLocaleDateString('es-ES')}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900">{formatMoney(q.total)}</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <Modal title="Resolver cotización" onClose={() => setSelected(null)} size="lg">
          <QuoteResolutionForm quote={selected} onApprove={handleApprove} onReject={handleReject} />
        </Modal>
      )}
    </div>
  );
}
