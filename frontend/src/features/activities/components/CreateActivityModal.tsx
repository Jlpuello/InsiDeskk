import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { activityApi } from '../api/activity.api.ts';
import { deviceApi } from '../../devices/api/device.api.ts';
import { ticketApi } from '../../tickets/api/ticket.api.ts';
import { userApi } from '../../users/api/user.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Device } from '../../devices/types/device.types.ts';
import type { Ticket } from '../../tickets/types/ticket.types.ts';
import type { UserSummary } from '../../users/types/user.types.ts';
import type { Activity, ActivityType } from '../types/activity.types.ts';

const TYPE_OPTIONS: { value: ActivityType; label: string }[] = [
  { value: 'mantenimiento', label: 'Mantenimiento planeado' },
  { value: 'integracion', label: 'Integración' },
  { value: 'seguimiento', label: 'Seguimiento' },
  { value: 'otro', label: 'Otro' },
];

interface CreateActivityModalProps {
  onClose: () => void;
  onCreated: (activity: Activity) => void;
}

export function CreateActivityModal({ onClose, onCreated }: CreateActivityModalProps) {
  const empresaId = useAuthStore((state) => state.user?.empresaId);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState<ActivityType>('mantenimiento');
  const [usuarioAsignadoId, setUsuarioAsignadoId] = useState('');
  const [dispositivoId, setDispositivoId] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [fechaPlaneada, setFechaPlaneada] = useState('');
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    userApi.list(empresaId).then((users) => setTechnicians(users.filter((u) => u.activo && u.rol !== 'cliente'))).catch(() => setTechnicians([]));
    deviceApi.list({ empresaId }).then(setDevices).catch(() => setDevices([]));
    ticketApi.list({ empresaId }).then(setTickets).catch(() => setTickets([]));
  }, [empresaId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!empresaId) {
      setError('Tu usuario no tiene una empresa asociada');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const activity = await activityApi.create({
        titulo,
        descripcion: descripcion || undefined,
        tipo,
        empresaId,
        usuarioAsignadoId: usuarioAsignadoId || undefined,
        dispositivoId: dispositivoId || undefined,
        ticketId: ticketId || undefined,
        fechaPlaneada: fechaPlaneada || undefined,
      });
      onCreated(activity);
    } catch {
      setError('No se pudo crear la actividad');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nueva actividad" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Título</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            required
            minLength={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as ActivityType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha planeada</label>
            <input
              type="date"
              value={fechaPlaneada}
              onChange={(e) => setFechaPlaneada(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Asignado a</label>
            <select
              value={usuarioAsignadoId}
              onChange={(e) => setUsuarioAsignadoId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Dispositivo</label>
            <select
              value={dispositivoId}
              onChange={(e) => setDispositivoId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Ninguno</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Ticket relacionado</label>
          <select
            value={ticketId}
            onChange={(e) => setTicketId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Ninguno</option>
            {tickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titulo}
              </option>
            ))}
          </select>
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
            disabled={saving || titulo.trim().length < 3}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear actividad'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
