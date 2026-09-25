import { Modal } from './Modal.tsx';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmClassName?: string;
  onClose: () => void;
  onConfirm: () => void;
}

// Genérico para "¿estás seguro?" simples, sin motivo — a diferencia de
// MotivoModal (que exige escribir por qué), acá alcanza con sí/no. Ver
// TopBar.tsx (cerrar sesión) como primer uso.
export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmClassName = 'bg-red-600 hover:bg-red-700',
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose} size="sm">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-md px-4 py-2 text-sm font-medium text-white ${confirmClassName}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
