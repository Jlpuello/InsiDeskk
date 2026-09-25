import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ClipboardList, Plus } from 'lucide-react';
import clsx from 'clsx';
import { activityApi } from '../api/activity.api.ts';
import { CreateActivityModal } from './CreateActivityModal.tsx';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Activity, ActivityStatus, ActivityType } from '../types/activity.types.ts';

const STATUS_LABELS: Record<ActivityStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const STATUS_STYLES: Record<ActivityStatus, string> = {
  pendiente: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-800',
};

const TYPE_LABELS: Record<ActivityType, string> = {
  mantenimiento: 'Mantenimiento',
  integracion: 'Integración',
  seguimiento: 'Seguimiento',
  otro: 'Otro',
};

const STATUS_OPTIONS: ActivityStatus[] = ['pendiente', 'en_progreso', 'completada', 'cancelada'];
const TYPE_OPTIONS: ActivityType[] = ['mantenimiento', 'integracion', 'seguimiento', 'otro'];

export function ActivityList() {
  const navigate = useNavigate();
  const rol = useAuthStore((state) => state.user?.rol);
  // El backend ya rechaza POST /activities para cliente (authorize
  // admin/tecnico) — esto solo evita mostrarle un botón que va a fallar. Debe
  // solicitarlas por ticket; la gestión interna crea la actividad desde ahí.
  const canCreate = rol === 'admin' || rol === 'tecnico';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function load(filters: { estado?: string; tipo?: string }) {
    setLoading(true);
    return activityApi
      .list({
        estado: (filters.estado || undefined) as ActivityStatus | undefined,
        tipo: (filters.tipo || undefined) as ActivityType | undefined,
      })
      .then(setActivities)
      .catch(() => setError('No se pudieron cargar las actividades'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load({});
  }, []);

  function handleFilterChange(patch: { estado?: string; tipo?: string }) {
    const next = { estado, tipo, ...patch };
    setEstado(next.estado);
    setTipo(next.tipo);
    load(next);
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Actividades</h1>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nueva actividad
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={estado}
          onChange={(e) => handleFilterChange({ estado: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={tipo}
          onChange={(e) => handleFilterChange({ tipo: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todo tipo</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {showCreateModal && (
        <CreateActivityModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(activity) => {
            setActivities((prev) => [activity, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">Cargando actividades...</p>
      ) : activities.length === 0 ? (
        <p className="text-gray-500">No hay actividades registradas.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actividad</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Asignado</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Planeada</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Acta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {activities.map((activity) => (
                <tr
                  key={activity.id}
                  onClick={() => navigate(`/activities/${activity.id}`)}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <ClipboardList size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {activity.titulo}
                          {activity.plantilla && <span className="ml-2 text-xs font-normal text-gray-400">(recurrente)</span>}
                        </p>
                        <p className="text-xs text-gray-400">{TYPE_LABELS[activity.tipo]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx('rounded-full px-2 py-1 text-xs font-medium', STATUS_STYLES[activity.estado])}
                    >
                      {STATUS_LABELS[activity.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{activity.usuarioAsignado?.nombre ?? 'Sin asignar'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {activity.fechaPlaneada ? new Date(activity.fechaPlaneada).toLocaleDateString('es-ES') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {activity.acta ? (
                      <CheckCircle2 size={16} className="text-green-600" />
                    ) : (
                      <span className="text-gray-300">—</span>
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
