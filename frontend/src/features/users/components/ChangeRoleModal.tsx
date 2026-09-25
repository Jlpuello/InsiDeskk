import { useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import type { UserRole, UserSummary } from '../types/user.types.ts';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'cliente', label: 'Cliente' },
];

interface ChangeRoleModalProps {
  user: UserSummary;
  onClose: () => void;
  onConfirm: (rol: UserRole, motivo: string) => Promise<void>;
}

// Cambiar el rol es una acción crítica — el backend exige `motivo` y la
// audita con detalle (ver UserService.update). Mismo patrón visual que
// MotivoModal, con el selector de rol agregado arriba del textarea.
export function ChangeRoleModal({ user, onClose, onConfirm }: ChangeRoleModalProps) {
  const [rol, setRol] = useState<UserRole>(user.rol);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rol === user.rol) {
      setError('Elegí un rol distinto al actual');
      return;
    }
    if (motivo.trim().length < 5) {
      setError('Indicá el motivo (mínimo 5 caracteres)');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onConfirm(rol, motivo.trim());
    } catch {
      setError('No se pudo cambiar el rol');
      setSaving(false);
    }
  }

  return (
    <Modal title="Cambiar rol" subtitle={`${user.nombre} · ${user.email}`} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Rol</label>
          <select
            value={rol}
            onChange={(e) => setRol(e.target.value as UserRole)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

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
            disabled={saving || rol === user.rol || motivo.trim().length < 5}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Cambiar rol'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
