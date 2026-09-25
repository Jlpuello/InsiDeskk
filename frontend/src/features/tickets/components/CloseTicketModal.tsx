import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { ImagePicker } from '../../../shared/components/ImagePicker.tsx';
import { extractImageFiles } from '../../../shared/utils/clipboardImages.ts';
import { ticketApi } from '../api/ticket.api.ts';
import type { Ticket } from '../types/ticket.types.ts';

const MAX_IMAGES = 5;

interface CloseTicketModalProps {
  ticketId: string;
  onClose: () => void;
  onClosed: (ticket: Ticket) => void;
}

export function CloseTicketModal({ ticketId, onClose, onClosed }: CloseTicketModalProps) {
  const [contenido, setContenido] = useState('');
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
    if (contenido.trim().length < 3) {
      setError('Describí qué se hizo para resolver el ticket (mínimo 3 caracteres)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ticket = await ticketApi.closeTicket(ticketId, contenido.trim(), images);
      onClosed(ticket);
    } catch {
      setError('No se pudo cerrar el ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Cerrar ticket" subtitle="Documentá la solución antes de cerrar" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Descripción de la solución</label>
          <textarea
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            onPaste={handlePaste}
            rows={4}
            required
            minLength={3}
            placeholder="Qué se hizo para resolver el problema... (podés pegar una captura con Ctrl+V)"
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
            disabled={saving || contenido.trim().length < 3}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Cerrando...' : 'Cerrar ticket'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
