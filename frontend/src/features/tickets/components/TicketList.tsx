import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import clsx from 'clsx';
import { ticketApi } from '../api/ticket.api.ts';
import { CreateTicketModal } from './CreateTicketModal.tsx';
import { getSlaBadge } from '../utils/sla.ts';
import { userApi } from '../../users/api/user.api.ts';
import type { UserSummary } from '../../users/types/user.types.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Ticket, TicketCategory, TicketPriority, TicketStatus } from '../types/ticket.types.ts';

const STATUS_LABELS: Record<TicketStatus, string> = {
  abierto: 'Abierto',
  en_progreso: 'En progreso',
  en_espera: 'En espera',
  esperando_aprobacion: 'Esperando aprobación',
  cerrado: 'Cerrado',
  cancelado: 'Cancelado',
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  abierto: 'bg-blue-100 text-blue-800',
  en_progreso: 'bg-amber-100 text-amber-800',
  en_espera: 'bg-purple-100 text-purple-800',
  esperando_aprobacion: 'bg-orange-100 text-orange-800',
  cerrado: 'bg-green-100 text-green-800',
  cancelado: 'bg-gray-100 text-gray-800',
};

// Mismo mapa de color que CreateTicketModal (SEVERITY_DOT) — un punto de
// color se lee de un vistazo mejor que texto capitalizado en una columna
// angosta, y mantiene la misma convención visual en toda la feature.
const PRIORITY_DOT: Record<TicketPriority, string> = {
  baja: 'bg-slate-400',
  media: 'bg-blue-500',
  alta: 'bg-amber-500',
  critica: 'bg-red-500',
};

const STATUS_OPTIONS: TicketStatus[] = [
  'abierto',
  'en_progreso',
  'en_espera',
  'esperando_aprobacion',
  'cerrado',
  'cancelado',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['baja', 'media', 'alta', 'critica'];

interface Filters {
  estado: string;
  prioridad: string;
  categoriaId: string;
  usuarioAsignadoId: string;
}

// Default de la lista: todo menos cerrado, no "todos los estados" — un
// admin/técnico entra a mirar lo que sigue activo, no el archivo histórico.
// "Todos los estados" queda como opción explícita aparte (value=''), y cada
// estado puntual (incluido "Cerrado") se elige a mano.
const DEFAULT_ESTADO = 'no-cerrado';
const EMPTY_FILTERS: Filters = { estado: DEFAULT_ESTADO, prioridad: '', categoriaId: '', usuarioAsignadoId: '' };

export function TicketList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const rol = useAuthStore((state) => state.user?.rol);
  const canFilterByAssignee = rol === 'admin' || rol === 'tecnico';

  // El KPI "Mis tickets" del Dashboard linkea a /tickets?asignado=yo — no
  // hay otra pantalla que arme filtros iniciales por URL hoy, así que se
  // resuelve puntual acá en vez de sumar un mecanismo genérico para esto solo.
  const initialFilters: Filters =
    searchParams.get('asignado') === 'yo' && currentUserId
      ? { ...EMPTY_FILTERS, usuarioAsignadoId: currentUserId }
      : EMPTY_FILTERS;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [technicians, setTechnicians] = useState<UserSummary[]>([]);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function load(activeFilters: Filters) {
    setLoading(true);
    return ticketApi
      .list({
        estado: (activeFilters.estado || undefined) as TicketStatus | 'no-cerrado' | undefined,
        prioridad: (activeFilters.prioridad || undefined) as TicketPriority | undefined,
        categoriaId: activeFilters.categoriaId || undefined,
        usuarioAsignadoId: activeFilters.usuarioAsignadoId || undefined,
      })
      .then(setTickets)
      .catch(() => setError('No se pudieron cargar los tickets'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(initialFilters);
    ticketApi
      .listCategories()
      .then((cats) => setCategories(cats.filter((c) => c.activo)))
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!canFilterByAssignee) return;
    userApi
      .list()
      .then((users) => setTechnicians(users.filter((u) => u.activo && u.rol !== 'cliente')))
      .catch(() => setTechnicians([]));
  }, [canFilterByAssignee]);

  function handleFilterChange(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(next);
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tickets</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Nuevo ticket
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={filters.estado}
          onChange={(e) => handleFilterChange({ estado: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value={DEFAULT_ESTADO}>Sin cerrar</option>
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={filters.prioridad}
          onChange={(e) => handleFilterChange({ prioridad: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs capitalize focus:border-blue-500 focus:outline-none"
        >
          <option value="">Toda prioridad</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>

        <select
          value={filters.categoriaId}
          onChange={(e) => handleFilterChange({ categoriaId: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">Toda categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        {canFilterByAssignee && (
          <select
            value={filters.usuarioAsignadoId}
            onChange={(e) => handleFilterChange({ usuarioAsignadoId: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todo asignado</option>
            <option value="sin-asignar">Sin asignar</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        )}

        {(filters.estado !== DEFAULT_ESTADO || filters.prioridad || filters.categoriaId || filters.usuarioAsignadoId) && (
          <button
            onClick={() => handleFilterChange(EMPTY_FILTERS)}
            className="text-xs text-gray-500 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {showCreateModal && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(ticket) => {
            setTickets((prev) => [ticket, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">Cargando tickets...</p>
      ) : tickets.length === 0 ? (
        <p className="text-gray-500">No hay tickets registrados.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ticket</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Prioridad</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Asignado</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">SLA</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tickets.map((ticket) => {
                const slaBadge =
                  ticket.estado === 'cancelado' || ticket.slaPausadoEn
                    ? null
                    : getSlaBadge(
                        ticket.slaResolucionVence,
                        ticket.estado === 'cerrado' ? ticket.closedAt : null,
                      );
                return (
                  <tr
                    key={ticket.id}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{ticket.titulo}</p>
                      <p className="font-mono text-xs text-gray-400">{ticket.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 capitalize text-gray-700">
                        <span className={clsx('h-2 w-2 rounded-full', PRIORITY_DOT[ticket.prioridad])} />
                        {ticket.prioridad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          STATUS_STYLES[ticket.estado],
                        )}
                      >
                        {STATUS_LABELS[ticket.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{ticket.usuarioAsignado?.nombre ?? 'Sin asignar'}</td>
                    <td className="px-4 py-3">
                      {slaBadge && (
                        <span className={clsx('rounded-full px-2 py-0.5 text-xs font-medium', slaBadge.className)}>
                          {slaBadge.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
