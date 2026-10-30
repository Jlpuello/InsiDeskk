import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import clsx from 'clsx';
import {
  Cpu,
  FileDown,
  History,
  Laptop,
  Monitor,
  Network,
  Package,
  Pencil,
  ScrollText,
  Terminal,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { MotivoModal } from '../../../shared/components/MotivoModal.tsx';
import { deviceApi } from '../api/device.api.ts';
import { remotelyApi } from '../../remotely/api/remotely.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { hasPermission } from '../../../shared/security/permissions.ts';
import { DeviceFormModal } from './DeviceFormModal.tsx';
import type { Device, DeviceStatus, DeviceTelemetry } from '../types/device.types.ts';
import type {
  ExecuteScriptResult,
  HardwareScanResult,
  NetworkScanResult,
  RemoteSessionHistoryEntry,
  ScriptExecutionEntry,
  SoftwareScanResult,
  StartSessionResult,
} from '../../remotely/types/remotely.types.ts';

type ModalKind = 'script' | 'hardware' | 'network' | 'software' | 'sessions' | 'scripts' | null;

function UsageBar({ label, percent }: { label: string; percent: number }) {
  const color = percent >= 90 ? 'bg-red-500' : percent >= 75 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{percent.toFixed(0)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}

function formatGb(value: number): string {
  return `${value.toFixed(1)} GB`;
}

// Remotely guarda los tags como un solo string separado por comas.
function parseTags(tags?: string | null): string[] {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// Botón de "vista" (abre un modal de solo lectura) — ícono + tooltip nativo
// (title/aria-label), visualmente más liviano que los botones de acción para
// no confundir "esto hace algo" con "esto solo muestra información".
function IconButton({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} — ${hint}`}
      aria-label={label}
      className="rounded-md border border-gray-300 p-2 text-gray-500 transition hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ScanButton({ onClick, scanning, hasData }: { onClick: () => void; scanning: boolean; hasData: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={scanning}
      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {scanning ? 'Analizando (hasta 30s)...' : hasData ? 'Re-analizar' : 'Analizar'}
    </button>
  );
}

function ScannedAt({ date }: { date?: string | null }) {
  if (!date) return null;
  return <p className="mb-4 text-xs text-gray-400">Analizado: {new Date(date).toLocaleString('es-ES')}</p>;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>;
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

// Acento superior de la card principal, a modo de "carátula" del expediente —
// mismo color que el badge de estado, para escanear de un vistazo.
const STATUS_BORDER: Record<DeviceStatus, string> = {
  online: 'border-t-green-500',
  offline: 'border-t-gray-300',
  inactivo: 'border-t-amber-500',
};

export function DeviceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const rol = user?.rol;
  const isStaff = rol === 'admin' || rol === 'tecnico';
  // Conectar/escanear/ver historial es una capacidad; ejecutar un script
  // arbitrario es otra, aparte y más sensible (ejecuta código) — un técnico
  // puntual puede tener una sin la otra, ver Usuarios → Permisos.
  const canConnect = isStaff && hasPermission(user, 'devices:remote-connect');
  const canExecuteScript = isStaff && hasPermission(user, 'devices:remote-script');
  const canUseRemotely = canConnect || canExecuteScript;
  // Mismo criterio que TicketDetail/TicketReport: reusa el GET que la propia
  // pantalla ya necesita, así que para cliente es un gate de conveniencia de
  // frontend, no un límite duro de backend.
  const canExportReport = isStaff || hasPermission(user, 'documents:export');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  // Un equipo que solo reporta por GLPI Agent (sin remotelyId) no tiene cómo
  // iniciar sesión remota ni correr un script vía Remotely — esos botones
  // solo tienen sentido si el equipo además tiene el agente de Remotely.
  const hasRemotelyAgent = Boolean(device?.remotelyId);
  const canConnectRemotely = canConnect && hasRemotelyAgent;
  const canExecuteScriptRemotely = canExecuteScript && hasRemotelyAgent;
  const [liveStatus, setLiveStatus] = useState<DeviceStatus | null>(null);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry | null>(null);
  const [history, setHistory] = useState<RemoteSessionHistoryEntry[]>([]);
  const [scriptHistory, setScriptHistory] = useState<ScriptExecutionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<ModalKind>(null);

  const [connectResult, setConnectResult] = useState<StartSessionResult | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [shell, setShell] = useState<'powershell' | 'bash' | 'cmd'>('powershell');
  const [script, setScript] = useState('');
  const [scriptResult, setScriptResult] = useState<ExecuteScriptResult | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [runningScript, setRunningScript] = useState(false);

  const [hardwareInfo, setHardwareInfo] = useState<HardwareScanResult | null>(null);
  const [hardwareError, setHardwareError] = useState<string | null>(null);
  const [scanningHardware, setScanningHardware] = useState(false);

  const [networkInfo, setNetworkInfo] = useState<NetworkScanResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [scanningNetwork, setScanningNetwork] = useState(false);

  const [softwareInfo, setSoftwareInfo] = useState<SoftwareScanResult | null>(null);
  const [softwareError, setSoftwareError] = useState<string | null>(null);
  const [scanningSoftware, setScanningSoftware] = useState(false);
  const [softwareFilter, setSoftwareFilter] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    // Session/script history son rutas de Remotely, gateadas a admin/tecnico
    // en el backend (403 para cliente) — no se piden para ese rol, para no
    // tirar abajo toda la carga de la página por un error ahí.
    Promise.all([
      deviceApi.getById(id),
      deviceApi.getStatus(id),
      deviceApi.getTelemetry(id),
      canUseRemotely ? remotelyApi.sessionHistory(id) : Promise.resolve([]),
      canUseRemotely ? remotelyApi.scriptHistory(id) : Promise.resolve([]),
    ])
      .then(([deviceData, status, telemetryData, historyData, scriptHistoryData]) => {
        if (cancelled) return;
        setDevice(deviceData);
        setLiveStatus(status);
        setTelemetry(telemetryData);
        setHistory(historyData);
        setScriptHistory(scriptHistoryData);
        // Si ya se corrió un análisis antes, mostrar lo persistido sin esperar
        // a que se vuelva a ejecutar el script (los 30s de Remotely pesan).
        if (deviceData.hwScannedAt) {
          setHardwareInfo({
            uuid: deviceData.hwUuid ?? null,
            serialNumber: deviceData.hwSerialNumber ?? null,
            board: deviceData.hwBoardInfo ?? null,
            battery: deviceData.hwBattery ?? null,
            cpu: deviceData.hwCpu ?? null,
            ramModules: deviceData.ramModules ?? [],
            ramSlotsUsed: deviceData.ramSlotsUsed ?? (deviceData.ramModules?.length ?? 0),
            ramSlotsTotal: deviceData.ramSlotsTotal ?? null,
            storage: deviceData.hwStorage ?? [],
            gpus: deviceData.hwGraphics?.gpus ?? [],
            monitors: deviceData.hwGraphics?.monitors ?? [],
            usbDevices: deviceData.hwUsbDevices ?? [],
            hwScannedAt: deviceData.hwScannedAt,
          });
        }
        if (deviceData.netScannedAt) {
          setNetworkInfo({
            interfaces: deviceData.netInterfaces ?? [],
            listening: deviceData.netListening ?? [],
            connections: deviceData.netConnections ?? [],
            netScannedAt: deviceData.netScannedAt,
          });
        }
        if (deviceData.swScannedAt) {
          setSoftwareInfo({
            apps: deviceData.swApps ?? [],
            totalCount: deviceData.swTotalCount ?? (deviceData.swApps?.length ?? 0),
            swScannedAt: deviceData.swScannedAt,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el dispositivo');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, canUseRemotely]);

  async function handleConnect() {
    if (!id) return;
    setConnecting(true);
    setConnectError(null);
    setConnectResult(null);
    try {
      const result = await remotelyApi.connect(id);
      setConnectResult(result);
    } catch {
      setConnectError(
        'No se pudo iniciar la sesión remota. Verificá que REMOTELY_SERVER_URL apunte a un servidor Remotely real.',
      );
    } finally {
      setConnecting(false);
    }
  }

  async function handleExecuteScript(e: FormEvent) {
    e.preventDefault();
    if (!id || !script.trim()) return;

    setRunningScript(true);
    setScriptError(null);
    setScriptResult(null);
    try {
      const result = await remotelyApi.executeScript(id, shell, script);
      setScriptResult(result);
      remotelyApi.scriptHistory(id).then(setScriptHistory).catch(() => {});
    } catch {
      setScriptError('No se pudo ejecutar el script. Verificá la conexión con Remotely.');
      // Se guarda igual del lado del backend (estado "failed"), así que
      // refrescamos el historial aunque el intento haya fallado.
      remotelyApi.scriptHistory(id).then(setScriptHistory).catch(() => {});
    } finally {
      setRunningScript(false);
    }
  }

  async function handleHardwareScan() {
    if (!id) return;
    setScanningHardware(true);
    setHardwareError(null);
    try {
      const result = await remotelyApi.hardwareScan(id);
      setHardwareInfo(result);
    } catch {
      setHardwareError(
        'No se pudo analizar el hardware. El script corre por el mismo canal que "Ejecutar script" — si eso falla, esto también.',
      );
    } finally {
      setScanningHardware(false);
    }
  }

  async function handleNetworkScan() {
    if (!id) return;
    setScanningNetwork(true);
    setNetworkError(null);
    try {
      const result = await remotelyApi.networkScan(id);
      setNetworkInfo(result);
    } catch {
      setNetworkError(
        'No se pudo analizar la red. El script corre por el mismo canal que "Ejecutar script" — si eso falla, esto también.',
      );
    } finally {
      setScanningNetwork(false);
    }
  }

  async function handleSoftwareScan() {
    if (!id) return;
    setScanningSoftware(true);
    setSoftwareError(null);
    try {
      const result = await remotelyApi.softwareScan(id);
      setSoftwareInfo(result);
    } catch {
      setSoftwareError(
        'No se pudo obtener el inventario de software. El script corre por el mismo canal que "Ejecutar script" — si eso falla, esto también.',
      );
    } finally {
      setScanningSoftware(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando dispositivo...</p>;
  if (error && !device) return <p className="p-6 text-red-600">{error}</p>;
  if (!device) return null;

  const estado = liveStatus ?? device.estado;
  const tags = parseTags(device.remotelyTags);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/devices" className="inline-block text-sm text-blue-600 hover:underline">
          ← Volver a dispositivos
        </Link>
        <div className="flex items-center gap-2">
          {canExportReport && (
            <Link
              to={`/devices/${device.id}/report`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={14} />
              Ficha PDF
            </Link>
          )}
          {isStaff && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={14} />
                Editar
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <Trash2 size={14} />
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>

      {showEditModal && (
        <DeviceFormModal
          device={device}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setDevice(updated);
            setShowEditModal(false);
          }}
        />
      )}
      {showDeleteModal && (
        <MotivoModal
          title="Eliminar dispositivo"
          subtitle={device.nombre}
          confirmLabel="Eliminar"
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async (motivo) => {
            if (!id) return;
            await deviceApi.remove(id, motivo);
            navigate('/devices');
          }}
        />
      )}

      {/* Card principal: identidad + acciones + telemetría — "carátula" de la hoja de vida */}
      <div className={clsx('mb-6 rounded-lg border border-t-4 border-gray-200 bg-white p-4 shadow-sm sm:p-6', STATUS_BORDER[estado])}>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="hidden shrink-0 rounded-lg bg-gray-100 p-2.5 text-gray-500 sm:block">
              <Laptop className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 sm:text-xl">{device.nombre}</h1>
              <p className="text-sm text-gray-500">
                {device.hostname}
                {device.remotelyAlias && device.remotelyAlias !== device.nombre && (
                  <span className="text-gray-400"> · alias en Remotely: {device.remotelyAlias}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', STATUS_STYLES[estado])}>
              {STATUS_LABELS[estado]}
            </span>
            {device.remotelyGroupName && (
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                {device.remotelyGroupName}
              </span>
            )}
          </div>
        </div>

        {(canConnectRemotely || canExecuteScriptRemotely) && (
          <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-gray-100 pb-4">
            {canConnectRemotely && (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Monitor className="h-4 w-4" />
                {connecting ? 'Conectando...' : 'Iniciar sesión remota'}
              </button>
            )}
            {canExecuteScriptRemotely && (
              <button
                onClick={() => setActiveModal('script')}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Terminal className="h-4 w-4" />
                Ejecutar script
              </button>
            )}

            {canConnectRemotely && (
              <>
                <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block" aria-hidden="true" />

                <div className="flex flex-wrap items-center gap-1.5">
                  <IconButton
                    icon={Cpu}
                    label="Hardware"
                    hint="CPU, RAM, discos, GPU y periféricos"
                    onClick={() => setActiveModal('hardware')}
                  />
                  <IconButton
                    icon={Network}
                    label="Red"
                    hint="Interfaces, puertos y conexiones activas"
                    onClick={() => setActiveModal('network')}
                  />
                  <IconButton
                    icon={Package}
                    label="Software"
                    hint="Programas instalados"
                    onClick={() => setActiveModal('software')}
                  />
                  <IconButton
                    icon={History}
                    label="Sesiones remotas"
                    hint={`${history.length} registradas`}
                    onClick={() => setActiveModal('sessions')}
                  />
                  <IconButton
                    icon={ScrollText}
                    label="Scripts ejecutados"
                    hint={`${scriptHistory.length} registrados`}
                    onClick={() => setActiveModal('scripts')}
                  />
                </div>
              </>
            )}

            {connectResult && (
              <a
                href={connectResult.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-green-700 underline"
              >
                Abrir sesión remota →
              </a>
            )}
          </div>
        )}
        {connectError && <p className="mb-4 text-sm text-red-600">{connectError}</p>}

        {tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-1 gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-400">Usuario actual</dt>
            <dd className="text-gray-800">{telemetry?.currentUser ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Sistema operativo</dt>
            <dd className="text-gray-800">
              {device.so ?? '—'} {device.versionSo}
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">IP local</dt>
            <dd className="font-mono text-gray-800">{device.ipLocal ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-400">CPU / RAM / Disco</dt>
            <dd className="text-gray-800">
              {device.cpuCores ?? '—'} cores · {device.ramGb ?? '—'} GB · {device.discoGb ?? '—'} GB
            </dd>
          </div>
          <div>
            <dt className="text-gray-400">ID Remotely</dt>
            <dd className="font-mono text-gray-800">{device.remotelyId ?? '—'}</dd>
          </div>
          {device.agentVersion && (
            <div>
              <dt className="text-gray-400">Versión del agente</dt>
              <dd className="text-gray-800">{device.agentVersion}</dd>
            </div>
          )}
          {device.glpiDeviceId && (
            <div>
              <dt className="text-gray-400">GLPI Agent</dt>
              <dd className="text-gray-800">
                {device.glpiTag && <span className="mr-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{device.glpiTag}</span>}
                {device.ultimoInventarioGlpi
                  ? `último inventario ${new Date(device.ultimoInventarioGlpi).toLocaleString()}`
                  : 'sin inventario reciente'}
              </dd>
            </div>
          )}
        </dl>

        {device.remotelyNotes && (
          <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">Notas</p>
            <p className="whitespace-pre-wrap">{device.remotelyNotes}</p>
          </div>
        )}

        {telemetry && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Telemetría en vivo</h2>
              <span className="text-xs text-gray-400">
                Actualizado: {new Date(telemetry.updatedAt).toLocaleTimeString('es-ES')}
              </span>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <UsageBar label="CPU" percent={telemetry.cpuUtilization * 100} />
              <UsageBar label="RAM" percent={telemetry.usedMemoryPercent * 100} />
              <UsageBar label="Disco" percent={telemetry.usedStoragePercent * 100} />
            </div>

            {telemetry.drives.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px] text-left text-xs">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="py-1">Unidad</th>
                      <th className="py-1">Formato</th>
                      <th className="py-1">Libre / Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {telemetry.drives.map((drive, i) => (
                      <tr key={i}>
                        <td className="py-1.5 font-medium text-gray-800">{drive.name ?? '—'}</td>
                        <td className="py-1.5 text-gray-500">{drive.driveFormat ?? '—'}</td>
                        <td className="py-1.5 text-gray-500">
                          {formatGb(drive.freeSpace)} / {formatGb(drive.totalSize)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Modal: Ejecutar script */}
      {activeModal === 'script' && (
        <Modal title="Ejecutar script" subtitle="Corre por el canal de Remotely" onClose={() => setActiveModal(null)}>
          <form onSubmit={handleExecuteScript}>
            <div className="mb-3 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Shell</label>
              <select
                value={shell}
                onChange={(e) => setShell(e.target.value as typeof shell)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="powershell">PowerShell</option>
                <option value="bash">Bash</option>
                <option value="cmd">CMD</option>
              </select>
            </div>

            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={5}
              placeholder="Get-Process"
              autoFocus
              className="mb-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mb-3 text-xs text-gray-400">
              En PowerShell, si el comando tiene bloques con llaves <code>{'{ }'}</code>, escribilo en una sola línea
              separando sentencias con <code>;</code> — Remotely lo corre como consola interactiva y un bloque
              multilínea puede quedar esperando el cierre sin devolver resultado.
            </p>

            <button
              type="submit"
              disabled={runningScript || !script.trim()}
              className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {runningScript ? 'Ejecutando (puede tardar hasta 30s)...' : 'Ejecutar'}
            </button>

            {scriptError && <p className="mt-3 text-sm text-red-600">{scriptError}</p>}
            {scriptResult && (
              <div className="mt-3 rounded-md bg-gray-900 p-3 font-mono text-xs text-gray-100">
                <p className="mb-1 text-gray-400">duración: {scriptResult.runTime}</p>
                {scriptResult.hadErrors && <p className="mb-1 text-red-300">El script reportó errores</p>}
                {scriptResult.standardOutput && scriptResult.standardOutput.length > 0 && (
                  <pre className="whitespace-pre-wrap">{scriptResult.standardOutput.join('\n')}</pre>
                )}
                {scriptResult.errorOutput && scriptResult.errorOutput.length > 0 && (
                  <pre className="whitespace-pre-wrap text-red-300">{scriptResult.errorOutput.join('\n')}</pre>
                )}
                {(!scriptResult.standardOutput || scriptResult.standardOutput.length === 0) &&
                  (!scriptResult.errorOutput || scriptResult.errorOutput.length === 0) && (
                    <p className="text-gray-500">Sin salida.</p>
                  )}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Modal: Hardware */}
      {activeModal === 'hardware' && (
        <Modal
          title="Hardware"
          subtitle="Identificación, CPU, RAM, discos, GPU y periféricos"
          onClose={() => setActiveModal(null)}
          size="lg"
          headerActions={
            <ScanButton onClick={handleHardwareScan} scanning={scanningHardware} hasData={!!hardwareInfo} />
          }
        >
          {hardwareError && <p className="mb-3 text-sm text-red-600">{hardwareError}</p>}

          {hardwareInfo ? (
            <div className="space-y-5">
              <ScannedAt date={hardwareInfo.hwScannedAt} />

              <div>
                <SectionHeading>Identificación</SectionHeading>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-400">UUID</dt>
                    <dd className="font-mono text-gray-800">{hardwareInfo.uuid ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Número de serie</dt>
                    <dd className="font-mono text-gray-800">{hardwareInfo.serialNumber ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Placa base</dt>
                    <dd className="text-gray-800">
                      {hardwareInfo.board?.motherboardManufacturer ?? '—'} {hardwareInfo.board?.motherboardProduct}{' '}
                      {hardwareInfo.board?.motherboardVersion}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">BIOS</dt>
                    <dd className="text-gray-800">
                      {hardwareInfo.board?.biosManufacturer ?? '—'} {hardwareInfo.board?.biosVersion}
                      {hardwareInfo.board?.biosReleaseDate &&
                        ` (${new Date(hardwareInfo.board.biosReleaseDate).toLocaleDateString('es-ES')})`}
                    </dd>
                  </div>
                </dl>
              </div>

              {hardwareInfo.battery && (
                <div>
                  <SectionHeading>Batería</SectionHeading>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-gray-400">Capacidad de fábrica</dt>
                      <dd className="text-gray-800">{hardwareInfo.battery.designCapacityMwh ?? '—'} mWh</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Capacidad actual</dt>
                      <dd className="text-gray-800">{hardwareInfo.battery.fullChargeCapacityMwh ?? '—'} mWh</dd>
                    </div>
                    <div>
                      <dt className="text-gray-400">Salud</dt>
                      <dd className="text-gray-800">
                        {hardwareInfo.battery.healthPercent != null ? `${hardwareInfo.battery.healthPercent}%` : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}

              <div>
                <SectionHeading>CPU</SectionHeading>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                  <div className="col-span-2">
                    <dt className="text-gray-400">Modelo</dt>
                    <dd className="text-gray-800">{hardwareInfo.cpu?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Núcleos / hilos</dt>
                    <dd className="text-gray-800">
                      {hardwareInfo.cpu?.cores ?? '—'} / {hardwareInfo.cpu?.logicalProcessors ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Frecuencia (actual / máx)</dt>
                    <dd className="text-gray-800">
                      {hardwareInfo.cpu?.currentClockMhz ?? '—'} / {hardwareInfo.cpu?.maxClockMhz ?? '—'} MHz
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-gray-400">Virtualización (VT-x / AMD-V)</dt>
                    <dd>
                      <span
                        className={clsx(
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          hardwareInfo.cpu?.virtualizationFirmwareEnabled
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600',
                        )}
                      >
                        {hardwareInfo.cpu?.virtualizationFirmwareEnabled ? 'Habilitada' : 'Deshabilitada'}
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <div>
                <SectionHeading>
                  Memoria RAM ({hardwareInfo.ramSlotsUsed} de {hardwareInfo.ramSlotsTotal ?? '?'} slots)
                </SectionHeading>
                {hardwareInfo.ramModules.length > 0 ? (
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-400">
                      <tr>
                        <th className="py-1">Slot</th>
                        <th className="py-1">Capacidad</th>
                        <th className="py-1">Velocidad</th>
                        <th className="py-1">Tipo</th>
                        <th className="py-1">Fabricante</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hardwareInfo.ramModules.map((mod, i) => (
                        <tr key={i}>
                          <td className="py-1.5 font-medium text-gray-800">{mod.slot ?? '—'}</td>
                          <td className="py-1.5 text-gray-600">{mod.capacityGb} GB</td>
                          <td className="py-1.5 text-gray-600">{mod.speedMhz ? `${mod.speedMhz} MHz` : '—'}</td>
                          <td className="py-1.5 text-gray-600">{mod.type ?? '—'}</td>
                          <td className="py-1.5 text-gray-500">{mod.manufacturer ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-gray-500">Sin módulos detectados.</p>
                )}
              </div>

              <div>
                <SectionHeading>Almacenamiento</SectionHeading>
                {hardwareInfo.storage.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="py-1">Modelo</th>
                          <th className="py-1">Interfaz</th>
                          <th className="py-1">Tipo</th>
                          <th className="py-1">Capacidad</th>
                          <th className="py-1">Salud</th>
                          <th className="py-1">Temp.</th>
                          <th className="py-1">Desgaste</th>
                          <th className="py-1">Horas enc.</th>
                          <th className="py-1">Serie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {hardwareInfo.storage.map((d, i) => (
                          <tr key={i}>
                            <td className="py-1.5 font-medium text-gray-800">{d.model ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{d.interfaceType ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{d.mediaType ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{d.sizeGb != null ? `${d.sizeGb} GB` : '—'}</td>
                            <td className="py-1.5 text-gray-600">{d.healthStatus ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{d.temperatureC ? `${d.temperatureC}°C` : '—'}</td>
                            <td className="py-1.5 text-gray-600">
                              {d.wearPercent != null ? `${d.wearPercent}%` : '—'}
                            </td>
                            <td className="py-1.5 text-gray-600">{d.powerOnHours ?? '—'}</td>
                            <td className="py-1.5 font-mono text-gray-500">{d.serialNumber ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin discos detectados.</p>
                )}
              </div>

              <div>
                <SectionHeading>Gráficos y monitores</SectionHeading>
                {hardwareInfo.gpus.length > 0 ? (
                  <ul className="mb-2 space-y-1 text-sm text-gray-800">
                    {hardwareInfo.gpus.map((g, i) => (
                      <li key={i}>
                        {g.name ?? '—'}
                        {g.vramGb ? ` · ${g.vramGb} GB VRAM` : ''}
                        {g.currentResolution
                          ? ` · ${g.currentResolution}${g.refreshRateHz ? `@${g.refreshRateHz}Hz` : ''}`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">Sin GPU detectada.</p>
                )}
                {hardwareInfo.monitors.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Monitores: {hardwareInfo.monitors.map((m) => m.name ?? '—').join(', ')}
                  </p>
                )}
              </div>

              {hardwareInfo.usbDevices.length > 0 && (
                <div>
                  <SectionHeading>Dispositivos USB</SectionHeading>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {hardwareInfo.usbDevices.map((u, i) => (
                      <li key={i}>{u.name ?? '—'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Todavía no se analizó el hardware de este equipo.</p>
          )}
        </Modal>
      )}

      {/* Modal: Red */}
      {activeModal === 'network' && (
        <Modal
          title="Red"
          subtitle="Interfaces, puertos en escucha y conexiones activas"
          onClose={() => setActiveModal(null)}
          size="lg"
          headerActions={<ScanButton onClick={handleNetworkScan} scanning={scanningNetwork} hasData={!!networkInfo} />}
        >
          {networkError && <p className="mb-3 text-sm text-red-600">{networkError}</p>}

          {networkInfo ? (
            <div className="space-y-5">
              <ScannedAt date={networkInfo.netScannedAt} />

              <div>
                <SectionHeading>Interfaces</SectionHeading>
                {networkInfo.interfaces.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="py-1">Nombre</th>
                          <th className="py-1">MAC</th>
                          <th className="py-1">Estado</th>
                          <th className="py-1">Velocidad</th>
                          <th className="py-1">IPv4</th>
                          <th className="py-1">Gateway</th>
                          <th className="py-1">DNS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {networkInfo.interfaces.map((iface, i) => (
                          <tr key={i}>
                            <td className="py-1.5 font-medium text-gray-800">{iface.name ?? '—'}</td>
                            <td className="py-1.5 font-mono text-gray-600">{iface.mac ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{iface.status ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">
                              {iface.speedMbps ? `${iface.speedMbps} Mbps` : '—'}
                            </td>
                            <td className="py-1.5 font-mono text-gray-600">{iface.ipv4 ?? '—'}</td>
                            <td className="py-1.5 font-mono text-gray-600">{iface.gateway ?? '—'}</td>
                            <td className="py-1.5 text-gray-500">{iface.dnsServers.join(', ') || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin interfaces detectadas.</p>
                )}
              </div>

              <div>
                <SectionHeading>Puertos en escucha ({networkInfo.listening.length})</SectionHeading>
                {networkInfo.listening.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-white text-gray-400">
                        <tr>
                          <th className="py-1">Puerto</th>
                          <th className="py-1">Proceso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {networkInfo.listening.map((p, i) => (
                          <tr key={i}>
                            <td className="py-1 font-mono text-gray-800">{p.localPort}</td>
                            <td className="py-1 text-gray-600">{p.process ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin puertos en escucha.</p>
                )}
              </div>

              <div>
                <SectionHeading>Conexiones activas ({networkInfo.connections.length})</SectionHeading>
                {networkInfo.connections.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="sticky top-0 bg-white text-gray-400">
                        <tr>
                          <th className="py-1">Local</th>
                          <th className="py-1">Remoto</th>
                          <th className="py-1">Proceso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {networkInfo.connections.map((c, i) => (
                          <tr key={i}>
                            <td className="py-1 font-mono text-gray-800">:{c.localPort}</td>
                            <td className="py-1 font-mono text-gray-600">
                              {c.remoteAddress ?? '—'}:{c.remotePort}
                            </td>
                            <td className="py-1 text-gray-600">{c.process ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Sin conexiones activas.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Todavía no se analizó la red de este equipo.</p>
          )}
        </Modal>
      )}

      {/* Modal: Software instalado */}
      {activeModal === 'software' && (
        <Modal
          title="Software instalado"
          subtitle='Sale del registro de Windows (mismo origen que "Programas y características")'
          onClose={() => setActiveModal(null)}
          size="lg"
          headerActions={
            <ScanButton onClick={handleSoftwareScan} scanning={scanningSoftware} hasData={!!softwareInfo} />
          }
        >
          {softwareError && <p className="mb-3 text-sm text-red-600">{softwareError}</p>}

          {softwareInfo ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-400">
                  {softwareInfo.totalCount} programas
                  {softwareInfo.swScannedAt &&
                    ` · analizado: ${new Date(softwareInfo.swScannedAt).toLocaleString('es-ES')}`}
                </p>
                <input
                  type="text"
                  value={softwareFilter}
                  onChange={(e) => setSoftwareFilter(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              {softwareInfo.apps.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white text-gray-400">
                      <tr>
                        <th className="py-1">Nombre</th>
                        <th className="py-1">Versión</th>
                        <th className="py-1">Editor</th>
                        <th className="py-1">Instalado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {softwareInfo.apps
                        .filter((a) => a.name.toLowerCase().includes(softwareFilter.toLowerCase()))
                        .map((a, i) => (
                          <tr key={i}>
                            <td className="py-1.5 font-medium text-gray-800">{a.name}</td>
                            <td className="py-1.5 text-gray-600">{a.version ?? '—'}</td>
                            <td className="py-1.5 text-gray-600">{a.publisher ?? '—'}</td>
                            <td className="py-1.5 text-gray-500">
                              {a.installDate ? new Date(a.installDate).toLocaleDateString('es-ES') : '—'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Sin programas detectados.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Todavía no se analizó el software de este equipo.</p>
          )}
        </Modal>
      )}

      {/* Modal: Historial de sesiones remotas */}
      {activeModal === 'sessions' && (
        <Modal title="Sesiones remotas" onClose={() => setActiveModal(null)}>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">Sin sesiones registradas todavía.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className="rounded-md bg-gray-50 p-3 text-sm">
                  <p className="text-gray-800">
                    {entry.usuario?.nombre ?? 'Usuario'} · {new Date(entry.fechaInicio).toLocaleString('es-ES')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.duracionMinutos != null ? `Duración: ${entry.duracionMinutos} min` : 'Sesión activa'} · ID:{' '}
                    {entry.remotelySessionId ?? '—'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Modal: Historial de scripts ejecutados */}
      {activeModal === 'scripts' && (
        <Modal title="Scripts ejecutados" onClose={() => setActiveModal(null)}>
          {scriptHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Sin scripts ejecutados todavía.</p>
          ) : (
            <ul className="space-y-2">
              {scriptHistory.map((entry) => (
                <li key={entry.id} className="rounded-md bg-gray-50 p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-gray-800">
                      {entry.usuario?.nombre ?? 'Usuario'} · {new Date(entry.createdAt).toLocaleString('es-ES')}
                    </p>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        entry.estado === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800',
                      )}
                    >
                      {entry.estado === 'completed' ? 'Completado' : 'Falló'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {entry.shell ?? '—'}
                    {entry.duracionSegundos != null && ` · ${entry.duracionSegundos}s`}
                  </p>
                  {entry.errorMessage && <p className="mt-1 text-xs text-red-600">{entry.errorMessage}</p>}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
