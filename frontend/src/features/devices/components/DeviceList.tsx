import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Laptop, Plus, ShieldCheck } from 'lucide-react';
import { deviceApi } from '../api/device.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { DeviceFormModal } from './DeviceFormModal.tsx';
import type { Device, DeviceStatus } from '../types/device.types.ts';

function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

const STATUS_LABELS: Record<DeviceStatus, string> = {
  online: 'En línea',
  offline: 'Fuera de línea',
  inactivo: 'Inactivo',
};

const STATUS_STYLES: Record<DeviceStatus, string> = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-gray-100 text-gray-800',
  inactivo: 'bg-amber-100 text-amber-800',
};

export function DeviceList() {
  const navigate = useNavigate();
  const rol = useAuthStore((state) => state.user?.rol);
  const canCreate = rol === 'admin' || rol === 'tecnico';
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function load() {
    return deviceApi
      .list()
      .then(setDevices)
      .catch(() => setError('No se pudieron cargar los dispositivos'));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-4 text-gray-500">Cargando dispositivos...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dispositivos</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nuevo dispositivo
          </button>
        )}
      </div>

      {showCreateModal && (
        <DeviceFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            load();
          }}
        />
      )}

      {devices.length === 0 ? (
        <p className="text-gray-500">No hay dispositivos registrados.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Dispositivo</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Grupo</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tags</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">SO</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">IP local</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Seguridad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((device) => (
                <tr
                  key={device.id}
                  onClick={() => navigate(`/devices/${device.id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Laptop size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{device.nombre}</p>
                        <p className="truncate text-xs text-gray-400">{device.hostname ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {device.remotelyGroupName ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        {device.remotelyGroupName}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {parseTags(device.remotelyTags).map((tag) => (
                        <span key={tag} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {device.so ?? '—'} {device.versionSo}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{device.ipLocal ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx('rounded-full px-2 py-1 text-xs font-medium', STATUS_STYLES[device.estado])}
                    >
                      {STATUS_LABELS[device.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {device.agentHardenedAt ? (
                      <span
                        className="flex items-center gap-1.5 text-xs font-medium text-green-700"
                        title={`Endurecido el ${new Date(device.agentHardenedAt).toLocaleString('es-ES')}`}
                      >
                        <ShieldCheck size={14} />
                        Protegido
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
