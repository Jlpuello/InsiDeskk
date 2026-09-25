import { useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { ticketApi } from '../api/ticket.api.ts';
import type { Ticket } from '../types/ticket.types.ts';

interface ReopenTicketModalProps {
  ticketId: string;
  onClose: () => void;
  onReopened: (ticket: Ticket) => void;
}

export function ReopenTicketModal({ ticketId, onClose, onReopened }: ReopenTicketModalProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 3) {
      setError('Explicá por qué se reabre el ticket (mínimo 3 caracteres)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ticket = await ticketApi.reopenTicket(ticketId, motivo.trim());
      onReopened(ticket);
    } catch {
      setError('No se pudo reabrir el ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Reabrir ticket" subtitle="El motivo queda registrado en el ticket" onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Motivo de la reapertura</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            required
            minLength={3}
            placeholder="Por qué hace falta reabrir este ticket..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
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
            disabled={saving || motivo.trim().length < 3}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Reabriendo...' : 'Reabrir ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
