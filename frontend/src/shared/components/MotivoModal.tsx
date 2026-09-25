import { useState, type FormEvent } from 'react';
import { Modal } from './Modal.tsx';

interface MotivoModalProps {
  title: string;
  subtitle?: string;
  confirmLabel?: string;
  confirmClassName?: string;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}

// Modal genérico para acciones críticas que exigen un motivo (cambiar el rol
// de un usuario, borrar un ticket/dispositivo, desactivar una empresa) — ver
// shared/security/critical-action.service.ts en el backend, que rechaza
// estas acciones sin `motivo`. Mismo patrón visual que ReopenTicketModal.
export function MotivoModal({
  title,
  subtitle,
  confirmLabel = 'Confirmar',
  confirmClassName = 'bg-red-600 hover:bg-red-700',
  onClose,
  onConfirm,
}: MotivoModalProps) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (motivo.trim().length < 5) {
      setError('Indicá el motivo (mínimo 5 caracteres)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onConfirm(motivo.trim());
    } catch {
      setError('No se pudo completar la acción');
      setSaving(false);
    }
  }

  return (
    <Modal title={title} subtitle={subtitle} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            required
            minLength={5}
            autoFocus
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
            disabled={saving || motivo.trim().length < 5}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmClassName}`}
          >
            {saving ? 'Guardando...' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
