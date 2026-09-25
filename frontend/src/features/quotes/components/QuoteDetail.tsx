import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import clsx from 'clsx';
import { FileDown, Send, X } from 'lucide-react';
import { quoteApi } from '../api/quote.api.ts';
import { SendQuoteModal } from './SendQuoteModal.tsx';
import { QuoteDocuments } from './QuoteDocuments.tsx';
import { AuthenticatedImage } from '../../../shared/components/AuthenticatedImage.tsx';
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

export function QuoteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rol = useAuthStore((state) => state.user?.rol);
  const isStaff = rol === 'admin' || rol === 'tecnico';

  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    quoteApi
      .getById(id)
      .then(setQuote)
      .catch(() => setError('No se pudo cargar la cotización'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleCancel() {
    if (!quote) return;
    setBusy(true);
    try {
      const updated = await quoteApi.cancel(quote.id);
      setQuote(updated);
    } catch {
      setError('No se pudo cancelar la solicitud');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!quote || !confirm('¿Eliminar este borrador?')) return;
    try {
      await quoteApi.remove(quote.id);
      navigate('/quotes');
    } catch {
      setError('No se pudo eliminar el borrador');
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando cotización...</p>;
  if (error || !quote) return <p className="p-6 text-red-600">{error ?? 'Cotización no encontrada'}</p>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/quotes" className="text-sm text-blue-600 hover:underline">
          ← Cotizaciones
        </Link>
        {quote.pdfPath && (
          <button
            onClick={() => quoteApi.downloadPdf(quote.id)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileDown size={14} />
            Descargar PDF
          </button>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400">
              Ticket:{' '}
              <Link to={`/tickets/${quote.ticketId}`} className="text-blue-600 hover:underline">
                {quote.ticket?.titulo ?? quote.ticketId.slice(0, 8)}
              </Link>
            </p>
            <p className="text-sm font-medium text-gray-900">{quote.empresa?.nombre}</p>
          </div>
          <span className={clsx('shrink-0 rounded-full px-3 py-1 text-xs font-medium', ESTADO_STYLES[quote.estado])}>
            {ESTADO_LABELS[quote.estado]}
          </span>
        </div>

        <div className="mb-4">
          <p className="mb-1 text-xs font-medium uppercase text-gray-400">Razón</p>
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{quote.razon}</p>
        </div>

        <div className="mb-4 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2 py-1.5">Concepto</th>
                <th className="px-2 py-1.5">Cantidad</th>
                <th className="px-2 py-1.5">Valor unit.</th>
                <th className="px-2 py-1.5">Imp. %</th>
                <th className="px-2 py-1.5">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.lineas.map((l) => (
                <tr key={l.id}>
                  <td className="px-2 py-1.5">{l.concepto}</td>
                  <td className="px-2 py-1.5">{l.cantidad}</td>
                  <td className="px-2 py-1.5">{formatMoney(l.valorUnitario)}</td>
                  <td className="px-2 py-1.5">{l.porcentajeImpuesto}%</td>
                  <td className="px-2 py-1.5">{formatMoney(l.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-4 flex justify-end">
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

        {quote.estado === 'pendiente_aprobacion' && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Esperando a {quote.contactoAutorizador?.nombre ?? 'el aprobador designado'} — el ticket queda pausado
            hasta que se resuelva.
          </p>
        )}
        {quote.estado === 'rechazado' && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Rechazada por {quote.resueltoNombre} el {new Date(quote.resueltoEn ?? '').toLocaleString('es-ES')} —{' '}
            {quote.motivoRechazo}
          </p>
        )}
        {quote.estado === 'aprobado' && (
          <div className="mb-4 rounded-md bg-green-50 px-3 py-3 text-sm text-green-800">
            <p className="mb-2">
              Aprobada por {quote.resueltoNombre} el {new Date(quote.resueltoEn ?? '').toLocaleString('es-ES')}
            </p>
            {quote.firmaImagen && (
              <AuthenticatedImage
                src={quote.firmaImagen}
                alt="Firma"
                className="h-16 rounded-md border border-green-200 bg-white"
              />
            )}
          </div>
        )}
        {quote.estado === 'expirado' && (
          <p className="mb-4 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
            El link de aprobación venció sin que nadie respondiera.
          </p>
        )}

        {isStaff && (quote.estado === 'borrador' || quote.estado === 'pendiente_aprobacion') && (
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            {quote.estado === 'borrador' && (
              <>
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Send size={14} />
                  Enviar a aprobación
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Eliminar borrador
                </button>
              </>
            )}
            {quote.estado === 'pendiente_aprobacion' && (
              <button
                onClick={handleCancel}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <X size={14} />
                {busy ? 'Cancelando...' : 'Cancelar solicitud'}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <QuoteDocuments quote={quote} canManage={isStaff} onChange={setQuote} />
      </div>

      {showSendModal && (
        <SendQuoteModal
          quote={quote}
          onClose={() => setShowSendModal(false)}
          onSent={(updated) => {
            setQuote(updated);
            setShowSendModal(false);
          }}
        />
      )}
    </div>
  );
}
