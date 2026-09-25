import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { deviceApi } from '../api/device.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { hasPermission } from '../../../shared/security/permissions.ts';
import type { Device } from '../types/device.types.ts';

const STATUS_LABELS: Record<string, string> = {
  online: 'En línea',
  offline: 'Fuera de línea',
  inactivo: 'Inactivo',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// Mismo patrón que TicketReport/InventoryReport: vista standalone pensada
// para imprimir o "Guardar como PDF" desde el navegador. A diferencia del
// equipo cargado a mano, un PC no tiene credenciales de administración que
// excluir — IP/MAC/seriales se muestran igual que en pantalla (ver
// shared/utils/mask.ts en el backend: son informativos, no secretos, en esta
// herramienta interna).
export function DeviceReport() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((state) => state.user);
  const isStaff = user?.rol === 'admin' || user?.rol === 'tecnico';
  const canExport = isStaff || hasPermission(user, 'documents:export');
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    deviceApi
      .getById(id)
      .then((data) => {
        if (!cancelled) setDevice(data);
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
  }, [id]);

  if (!canExport) return <p className="p-6 text-red-600">No tenés permiso para exportar esta ficha.</p>;
  if (loading) return <p className="p-6 text-gray-500">Cargando ficha...</p>;
  if (error || !device) return <p className="p-6 text-red-600">{error ?? 'Dispositivo no encontrado'}</p>;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-xs text-gray-400">Ficha de PC — vista de impresión</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Printer size={16} />
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="mb-6 border-b border-gray-200 pb-4">
        <p className="text-xs uppercase tracking-wide text-gray-400">Ficha de inventario</p>
        <h1 className="text-xl font-semibold text-gray-900">{device.nombre}</h1>
        <p className="mt-1 text-xs text-gray-400">PC con agente · Generado el {new Date().toLocaleString('es-ES')}</p>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Empresa" value={device.empresa?.nombre ?? '—'} />
        <Field label="Hostname" value={device.hostname ?? '—'} />
        <Field label="Estado" value={STATUS_LABELS[device.estado] ?? device.estado} />
        <Field label="Sistema operativo" value={[device.so, device.versionSo].filter(Boolean).join(' ') || '—'} />
        <Field label="IP local" value={device.ipLocal ?? '—'} />
        <Field label="Grupo" value={device.remotelyGroupName ?? '—'} />
        <Field label="CPU" value={device.hwCpu?.name ?? (device.cpuCores ? `${device.cpuCores} núcleos` : '—')} />
        <Field label="RAM" value={device.ramGb ? `${device.ramGb} GB` : '—'} />
        <Field label="Disco" value={device.discoGb ? `${device.discoGb} GB` : '—'} />
        <Field label="N° de serie" value={device.hwSerialNumber ?? '—'} />
        <Field label="Versión del agente" value={device.agentVersion ?? '—'} />
      </dl>

      {device.hwStorage && device.hwStorage.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Almacenamiento</p>
          <ul className="space-y-1 text-sm text-gray-800">
            {device.hwStorage.map((drive, i) => (
              <li key={i}>
                {drive.model ?? 'Disco'} — {drive.sizeGb ? `${drive.sizeGb.toFixed(0)} GB` : '—'}
                {drive.mediaType ? ` (${drive.mediaType})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {device.netInterfaces && device.netInterfaces.length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Interfaces de red</p>
          <ul className="space-y-1 text-sm text-gray-800">
            {device.netInterfaces.map((iface, i) => (
              <li key={i}>
                {iface.name ?? 'Interfaz'} — {iface.ipv4 ?? 'sin IP'} {iface.status ? `(${iface.status})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 border-t border-gray-100 pt-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Hardware</p>
          <p className="text-gray-800">
            {device.hwScannedAt ? `Escaneado el ${new Date(device.hwScannedAt).toLocaleDateString('es-ES')}` : 'Sin escanear'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Software</p>
          <p className="text-gray-800">
            {device.swScannedAt
              ? `${device.swTotalCount ?? 0} programas instalados (${new Date(device.swScannedAt).toLocaleDateString('es-ES')})`
              : 'Sin escanear'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Red</p>
          <p className="text-gray-800">
            {device.netScannedAt ? `Escaneado el ${new Date(device.netScannedAt).toLocaleDateString('es-ES')}` : 'Sin escanear'}
          </p>
        </div>
      </div>
    </div>
  );
}
