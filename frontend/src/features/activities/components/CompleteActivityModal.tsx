import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { ImagePicker } from '../../../shared/components/ImagePicker.tsx';
import { extractImageFiles } from '../../../shared/utils/clipboardImages.ts';
import { activityApi } from '../api/activity.api.ts';
import type { Activity } from '../types/activity.types.ts';

const MAX_IMAGES = 5;

interface CompleteActivityModalProps {
  activityId: string;
  onClose: () => void;
  onCompleted: (activity: Activity) => void;
}

// Separado del acta de entrega a propósito: esto queda registrado en TODA
// actividad completada, se genere o no un acta después (el acta, si se
// genera, reusa este texto en vez de volver a pedirlo).
export function CompleteActivityModal({ activityId, onClose, onCompleted }: CompleteActivityModalProps) {
  const [resultado, setResultado] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = extractImageFiles(e.clipboardData);
    if (pasted.length === 0) return;
    e.preventDefault();
    setImages((prev) => [...prev, ...pasted].slice(0, MAX_IMAGES));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (resultado.trim().length < 3) {
      setError('Indicá qué se realizó (mínimo 3 caracteres)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const activity = await activityApi.completeActivity(activityId, resultado.trim(), images);
      onCompleted(activity);
    } catch {
      setError('No se pudo completar la actividad');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Completar actividad" subtitle="Indicá qué se realizó" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">¿Qué se realizó?</label>
          <textarea
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            required
            minLength={3}
            placeholder="Qué se hizo, qué quedó verificado... (podés pegar una captura con Ctrl+V)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Fotos de evidencia <span className="font-normal text-gray-400">(opcional, hasta {MAX_IMAGES})</span>
          </label>
          <ImagePicker images={images} onChange={setImages} maxImages={MAX_IMAGES} />
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
            disabled={saving || resultado.trim().length < 3}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Completando...' : 'Completar actividad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
