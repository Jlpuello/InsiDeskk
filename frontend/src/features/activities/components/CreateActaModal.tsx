import { useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { activityApi } from '../api/activity.api.ts';
import { SignaturePad } from '../../../shared/components/SignaturePad.tsx';
import type { Acta } from '../types/activity.types.ts';

interface CreateActaModalProps {
  activityId: string;
  // Ya quedó registrado al completar la actividad (ver CompleteActivityModal)
  // — el acta lo reusa tal cual, no se vuelve a pedir.
  resultado: string;
  onClose: () => void;
  onCreated: (acta: Acta) => void;
}

export function CreateActaModal({ activityId, resultado, onClose, onCreated }: CreateActaModalProps) {
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaBlob, setFirmaBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = firmaNombre.trim().length >= 2 && !!firmaBlob;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !firmaBlob) {
      setError('Completá el nombre de quien firma y la firma dibujada');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const acta = await activityApi.createActa(activityId, firmaNombre.trim(), firmaBlob);
      onCreated(acta);
    } catch {
      setError('No se pudo generar el acta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Generar acta de entrega" subtitle="Firma del cliente sobre el trabajo ya registrado" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Resumen del trabajo realizado</p>
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">{resultado}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de quien firma</label>
          <input
            type="text"
            value={firmaNombre}
            onChange={(e) => setFirmaNombre(e.target.value)}
            required
            minLength={2}
            placeholder="Nombre completo"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Firma</label>
          <SignaturePad onChange={setFirmaBlob} />
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
            disabled={saving || !canSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Generando...' : 'Generar acta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
