import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Send, X } from 'lucide-react';
import clsx from 'clsx';
import { quoteApi } from '../api/quote.api.ts';
import { CreateQuoteModal } from './CreateQuoteModal.tsx';
import { SendQuoteModal } from './SendQuoteModal.tsx';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Quote } from '../types/quote.types.ts';

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pendiente de aprobación',
  aprobado: 'Aprobada',
  rechazado: 'Rechazada',
  expirado: 'Expirada',
};

const ESTADO_STYLES: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  pendiente_aprobacion: 'bg-amber-100 text-amber-800',
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
  expirado: 'bg-gray-100 text-gray-500',
};

function formatMoney(value: string): string {
  return Number(value).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface QuoteSectionProps {
  ticketId: string;
  empresaId: string;
}

// Sección embebida en el detalle del ticket — cotizaciones/solicitudes de
// cambio que requieren autorización del cliente antes de proceder (ver
// features/quotes). Mientras una está "pendiente_aprobacion", el ticket
// mismo queda bloqueado y su SLA pausado (ver TicketService.pauseForApproval
// en el backend) — eso se ve reflejado en el estado del ticket, no acá.
export function QuoteSection({ ticketId, empresaId }: QuoteSectionProps) {
  const rol = useAuthStore((state) => state.user?.rol);
  const isStaff = rol === 'admin' || rol === 'tecnico';

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sendingQuote, setSendingQuote] = useState<Quote | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    return quoteApi
      .listByTicket(ticketId)
      .then(setQuotes)
      .catch(() => setError('No se pudieron cargar las cotizaciones'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  async function handleCancel(quote: Quote) {
    setBusyId(quote.id);
    try {
      await quoteApi.cancel(quote.id);
      await load();
    } catch {
      setError('No se pudo cancelar la solicitud');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteDraft(quote: Quote) {
    if (!confirm('¿Eliminar este borrador?')) return;
    setBusyId(quote.id);
    try {
      await quoteApi.remove(quote.id);
      await load();
    } catch {
      setError('No se pudo eliminar el borrador');
    } finally {
      setBusyId(null);
    }
  }

  const hasPending = quotes.some((q) => q.estado === 'pendiente_aprobacion');

  if (!isStaff && quotes.length === 0 && !loading) return null;

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <FileText size={16} />
          Cotizaciones / Cambios
        </h2>
        {isStaff && !hasPending && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
          >
            <Plus size={14} />
            Nueva cotización
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-gray-500">Sin cotizaciones registradas para este ticket.</p>
      ) : (
        <ul className="space-y-2">
          {quotes.map((q) => (
            <li key={q.id} className="rounded-md border border-gray-200 p-3">
              <div className="mb-1 flex items-start justify-between gap-2">
                <Link to={`/quotes/${q.id}`} className="text-sm text-gray-800 hover:text-blue-600 hover:underline">
                  {q.razon}
                </Link>
                <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', ESTADO_STYLES[q.estado])}>
                  {ESTADO_LABELS[q.estado]}
                </span>
              </div>
              <p className="mb-2 text-xs text-gray-400">Total: {formatMoney(q.total)}</p>

              {q.estado === 'pendiente_aprobacion' && (
                <p className="mb-2 text-xs text-amber-700">
                  Esperando a {q.contactoAutorizador?.nombre ?? 'el aprobador designado'}
                </p>
              )}
              {q.estado === 'rechazado' && q.motivoRechazo && (
                <p className="mb-2 text-xs text-red-700">Motivo: {q.motivoRechazo}</p>
              )}
              {q.estado === 'aprobado' && q.resueltoNombre && (
                <p className="mb-2 text-xs text-green-700">
                  Aprobada por {q.resueltoNombre}
                  {q.resueltoEn && ` el ${new Date(q.resueltoEn).toLocaleString('es-ES')}`}
                </p>
              )}

              {isStaff && q.estado === 'borrador' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setSendingQuote(q)}
                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <Send size={12} />
                    Enviar a aprobación
                  </button>
                  <button
                    onClick={() => handleDeleteDraft(q)}
                    disabled={busyId === q.id}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              )}
              {isStaff && q.estado === 'pendiente_aprobacion' && (
                <button
                  onClick={() => handleCancel(q)}
                  disabled={busyId === q.id}
                  className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  <X size={12} />
                  {busyId === q.id ? 'Cancelando...' : 'Cancelar solicitud'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showCreateModal && (
        <CreateQuoteModal
          ticketId={ticketId}
          empresaId={empresaId}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {sendingQuote && (
        <SendQuoteModal
          quote={sendingQuote}
          onClose={() => setSendingQuote(null)}
          onSent={() => {
            setSendingQuote(null);
            load();
          }}
        />
      )}
    </div>
  );
}
