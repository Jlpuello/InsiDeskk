import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { quoteApi } from '../api/quote.api.ts';
import type { Quote, QuoteApprover } from '../types/quote.types.ts';

interface SendQuoteModalProps {
  quote: Quote;
  onClose: () => void;
  onSent: (quote: Quote) => void;
}

export function SendQuoteModal({ quote, onClose, onSent }: SendQuoteModalProps) {
  const [approvers, setApprovers] = useState<QuoteApprover[]>([]);
  const [contactoAutorizadorId, setContactoAutorizadorId] = useState('');
  const [loadingApprovers, setLoadingApprovers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    quoteApi
      .listApprovers(quote.empresaId)
      .then(setApprovers)
      .catch(() => setError('No se pudieron cargar los aprobadores'))
      .finally(() => setLoadingApprovers(false));
  }, [quote.empresaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contactoAutorizadorId) return;

    setSaving(true);
    setError(null);
    try {
      const updated = await quoteApi.send(quote.id, contactoAutorizadorId);
      onSent(updated);
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? 'No se pudo enviar la cotización a aprobación');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Enviar a aprobación"
      subtitle="El ticket queda pausado (SLA incluido) hasta que se resuelva"
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Aprobador</label>
          {loadingApprovers ? (
            <p className="text-sm text-gray-500">Cargando...</p>
          ) : approvers.length === 0 ? (
            <p className="text-sm text-amber-600">
              Esta empresa no tiene ningún usuario marcado como aprobador — configuralo en Usuarios antes de
              enviar.
            </p>
          ) : (
            <select
              value={contactoAutorizadorId}
              onChange={(e) => setContactoAutorizadorId(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Elegir...</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.email})
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !contactoAutorizadorId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
