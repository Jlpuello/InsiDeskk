import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicQuoteApi } from '../api/public-quote.api.ts';
import { QuoteResolutionForm } from './QuoteResolutionForm.tsx';
import type { Quote } from '../types/quote.types.ts';

// Página sin login — el link de aprobación por correo apunta acá (ver
// backend: /api/public/quotes/:token). El token en la URL es la única
// credencial; no requiere cuenta en el sistema.
export function PublicQuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    publicQuoteApi
      .getByToken(token)
      .then(setQuote)
      .catch(() => setError('No encontramos esta cotización — el link puede estar mal copiado.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleApprove(firmaNombre: string, firma: Blob) {
    if (!token) return;
    const updated = await publicQuoteApi.approve(token, firmaNombre, firma);
    setQuote(updated);
  }

  async function handleReject(nombre: string, motivo: string) {
    if (!token) return;
    const updated = await publicQuoteApi.reject(token, nombre, motivo);
    setQuote(updated);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold text-gray-900">Aprobación de cotización</h1>
        <p className="mb-6 text-sm text-gray-500">Revisá el detalle antes de aprobar o rechazar.</p>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {quote && (
          <QuoteResolutionForm quote={quote} onApprove={handleApprove} onReject={handleReject} />
        )}
      </div>
    </div>
  );
}
