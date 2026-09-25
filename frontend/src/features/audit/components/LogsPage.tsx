import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { auditApi, type AuditLogFilters, type FailedLoginFilters } from '../api/audit.api.ts';
import type { AuditLogEntry, FailedLoginEntry } from '../types/audit.types.ts';

type Tab = 'auditoria' | 'fallidos';
const PAGE_SIZE = 50;

const ACCION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Borrado',
  ROLE_CHANGE: 'Cambio de rol',
  PERMISOS_CHANGE: 'Cambio de permisos',
  TICKET_DELETE: 'Borrar ticket',
  DEVICE_DELETE: 'Borrar dispositivo',
  USER_DELETE: 'Borrar usuario',
  COMPANY_DEACTIVATE: 'Desactivar empresa',
};

const CRITICAL_ACTIONS = new Set([
  'ROLE_CHANGE',
  'PERMISOS_CHANGE',
  'TICKET_DELETE',
  'DEVICE_DELETE',
  'USER_DELETE',
  'COMPANY_DEACTIVATE',
]);

// Mismos códigos que AuthService#recordFailedAttempt en el backend.
const RAZON_LABELS: Record<string, string> = {
  usuario_no_existe: 'El usuario no existe',
  usuario_inactivo: 'Usuario inactivo',
  password_incorrecto: 'Contraseña incorrecta',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES');
}

// Fila expandible — el detalle (antes/después crudo, IP, user-agent) queda
// colapsado por default porque para el 95% de los casos alcanza con
// acción/tabla/actor/motivo, ver diseño de la sección.
function AuditRow({ log }: { log: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail =
    (log.cambiosNuevos && Object.keys(log.cambiosNuevos).length > 0) ||
    (log.cambiosAnteriores && Object.keys(log.cambiosAnteriores).length > 0) ||
    log.ipAddress ||
    log.userAgent ||
    log.errorMessage;

  return (
    <>
      <tr
        className={clsx('border-t border-gray-100 transition-colors', hasDetail && 'cursor-pointer hover:bg-gray-50')}
        onClick={() => hasDetail && setExpanded((v) => !v)}
      >
        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(log.createdAt)}</td>
        <td className="px-4 py-3">
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              CRITICAL_ACTIONS.has(log.accion) ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700',
            )}
          >
            {ACCION_LABELS[log.accion] ?? log.accion}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{log.tabla}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                log.usuario ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400',
              )}
            >
              {log.usuario ? log.usuario.nombre.charAt(0).toUpperCase() : 'S'}
            </span>
            {log.usuario ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{log.usuario.nombre}</p>
                <p className="truncate text-xs text-gray-400">{log.usuario.email}</p>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Sistema</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{log.motivo ?? '—'}</td>
        <td className="px-4 py-3">
          <span className={clsx('text-xs font-medium', log.resultado === 'failure' ? 'text-red-600' : 'text-green-700')}>
            {log.resultado === 'failure' ? 'Falló' : 'OK'}
          </span>
        </td>
        <td className="px-2 py-3 text-gray-300">{hasDetail && (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}</td>
      </tr>
      {expanded && hasDetail && (
        <tr className="border-t border-gray-100 bg-gray-50">
          <td colSpan={7} className="px-4 py-3">
            <div className="grid gap-3 text-xs text-gray-600 sm:grid-cols-2">
              {log.ipAddress && (
                <p>
                  <span className="font-medium text-gray-500">IP:</span> {log.ipAddress}
                </p>
              )}
              {log.userAgent && (
                <p className="truncate">
                  <span className="font-medium text-gray-500">User-agent:</span> {log.userAgent}
                </p>
              )}
              {log.errorMessage && (
                <p className="text-red-600 sm:col-span-2">
                  <span className="font-medium">Error:</span> {log.errorMessage}
                </p>
              )}
            </div>
            {log.cambiosNuevos && Object.keys(log.cambiosNuevos).length > 0 && (
              <pre className="mt-2 overflow-x-auto rounded-md bg-white p-2 text-xs text-gray-700 border border-gray-200">
                {JSON.stringify(log.cambiosNuevos, null, 2)}
              </pre>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function AuditoriaTab() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [acciones, setAcciones] = useState<string[]>([]);
  const [tablas, setTablas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const [accion, setAccion] = useState('');
  const [tabla, setTabla] = useState('');
  const [resultado, setResultado] = useState<'' | 'success' | 'failure'>('');
  // Por default solo lo crítico (cambio de rol/permisos, borrados,
  // desactivar empresa) — el auto-audit genérico de cualquier UPDATE (ej. el
  // poller de Remotely actualizando el estado de cada dispositivo) hace ruido
  // y no es lo que un admin busca el 95% de las veces.
  const [soloConMotivo, setSoloConMotivo] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  useEffect(() => {
    auditApi.listAcciones().then(setAcciones).catch(() => setAcciones([]));
    auditApi.listTablas().then(setTablas).catch(() => setTablas([]));
  }, []);

  const filters: AuditLogFilters = useMemo(
    () => ({
      accion: accion || undefined,
      tabla: tabla || undefined,
      resultado: resultado || undefined,
      soloConMotivo: soloConMotivo || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    [accion, tabla, resultado, soloConMotivo, desde, hasta, page],
  );

  useEffect(() => {
    setLoading(true);
    auditApi
      .listLogs(filters)
      .then(({ data, total }) => {
        setLogs(data);
        setTotal(total);
      })
      .catch(() => setError('No se pudo cargar el registro de auditoría'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    setPage(0);
  }, [accion, tabla, resultado, soloConMotivo, desde, hasta]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Acción</label>
          <select value={accion} onChange={(e) => setAccion(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            {acciones.map((a) => (
              <option key={a} value={a}>
                {ACCION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Tabla</label>
          <select value={tabla} onChange={(e) => setTabla(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Todas</option>
            {tablas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Resultado</label>
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value as '' | 'success' | 'failure')}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="success">OK</option>
            <option value="failure">Falló</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <label className="flex items-center gap-1.5 pb-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloConMotivo} onChange={(e) => setSoloConMotivo(e.target.checked)} className="rounded border-gray-300" />
          Solo acciones críticas
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500">No hay registros que coincidan con el filtro.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Acción</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Tabla</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Actor</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Motivo</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Resultado</th>
                  <th className="px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              {total} registro{total !== 1 ? 's' : ''} — página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FallidosTab() {
  const [entries, setEntries] = useState<FailedLoginEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState('');

  const filters: FailedLoginFilters = useMemo(
    () => ({ email: email || undefined, skip: page * PAGE_SIZE, take: PAGE_SIZE }),
    [email, page],
  );

  useEffect(() => {
    setLoading(true);
    auditApi
      .listFailedLogins(filters)
      .then(({ data, total }) => {
        setEntries(data);
        setTotal(total);
      })
      .catch(() => setError('No se pudieron cargar los intentos fallidos'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    setPage(0);
  }, [email]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4">
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Buscar por email..."
          className="w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-500">Sin intentos fallidos registrados.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Fecha</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Razón</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => (
                  <tr key={e.id} className="transition-colors hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatDate(e.createdAt)}</td>
                    <td className="px-4 py-3 text-gray-800">{e.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                        {RAZON_LABELS[e.razon] ?? e.razon}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{e.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              {total} registro{total !== 1 ? 's' : ''} — página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function LogsPage() {
  const [tab, setTab] = useState<Tab>('auditoria');

  return (
    <div className="p-6">
      <h1 className="mb-1 text-2xl font-semibold">Logs</h1>
      <p className="mb-4 text-sm text-gray-500">
        Registro de auditoría de la plataforma — quién hizo qué, cuándo y por qué.
      </p>

      <div className="mb-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('auditoria')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab === 'auditoria' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          Auditoría
        </button>
        <button
          onClick={() => setTab('fallidos')}
          className={clsx(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
            tab === 'fallidos' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700',
          )}
        >
          Intentos de login fallidos
        </button>
      </div>

      {tab === 'auditoria' ? <AuditoriaTab /> : <FallidosTab />}
    </div>
  );
}
