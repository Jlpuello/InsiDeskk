import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Download, Fingerprint, Laptop, Network, Plus, Printer, Router, Video, Wifi } from 'lucide-react';
import clsx from 'clsx';
import { inventoryApi } from '../api/inventory.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import { hasPermission } from '../../../shared/security/permissions.ts';
import { InventoryFormModal } from './InventoryFormModal.tsx';
import type {
  InventoryEquipmentStatus,
  InventoryEquipmentType,
  InventoryListItem,
  InventoryListTipo,
} from '../types/inventory.types.ts';
import type { Device, DeviceStatus } from '../../devices/types/device.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const TIPO_LABELS: Record<InventoryEquipmentType, string> = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Access Point',
  impresora: 'Impresora',
  dvr: 'DVR',
  camara_ip: 'Cámara IP',
  control_acceso: 'Control de acceso',
};

const TIPO_ICONS: Record<InventoryEquipmentType, typeof Router> = {
  router: Router,
  switch: Network,
  access_point: Wifi,
  impresora: Printer,
  dvr: Video,
  camara_ip: Camera,
  control_acceso: Fingerprint,
};

const ESTADO_LABELS: Record<InventoryEquipmentStatus, string> = {
  activo: 'Activo',
  en_reparacion: 'En reparación',
  dado_de_baja: 'Dado de baja',
};

const ESTADO_STYLES: Record<InventoryEquipmentStatus, string> = {
  activo: 'bg-green-100 text-green-800',
  en_reparacion: 'bg-amber-100 text-amber-800',
  dado_de_baja: 'bg-gray-100 text-gray-800',
};

const DEVICE_ESTADO_LABELS: Record<DeviceStatus, string> = {
  online: 'En línea',
  offline: 'Fuera de línea',
  inactivo: 'Inactivo',
};

const DEVICE_ESTADO_STYLES: Record<DeviceStatus, string> = {
  online: 'bg-green-100 text-green-800',
  offline: 'bg-gray-100 text-gray-800',
  inactivo: 'bg-amber-100 text-amber-800',
};

function datosDisponibles(device: Device): string {
  const disponibles: string[] = [];
  if (device.hwScannedAt) disponibles.push('Hardware');
  if (device.swScannedAt) disponibles.push('Software');
  if (device.netScannedAt) disponibles.push('Red');
  return disponibles.length > 0 ? disponibles.join(', ') : 'Sin escanear';
}

interface Filters {
  tipo: string;
  estado: string;
  empresaId: string;
  search: string;
}

const EMPTY_FILTERS: Filters = { tipo: '', estado: '', empresaId: '', search: '' };

export function InventoryList() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const rol = user?.rol;
  const isAdmin = rol === 'admin';
  const canExport = hasPermission(user, 'inventory:export');

  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  function buildApiFilters(activeFilters: Filters) {
    return {
      tipo: (activeFilters.tipo || undefined) as InventoryListTipo | undefined,
      estado: activeFilters.estado || undefined,
      empresaId: activeFilters.empresaId || undefined,
      search: activeFilters.search || undefined,
    };
  }

  function load(activeFilters: Filters) {
    setLoading(true);
    return inventoryApi
      .list(buildApiFilters(activeFilters))
      .then(setItems)
      .catch(() => setError('No se pudo cargar el inventario'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(EMPTY_FILTERS);
    if (isAdmin) {
      companyApi.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isAdmin]);

  function handleFilterChange(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    // Cambiar el tipo invalida el estado elegido antes: el vocabulario de
    // estado depende de si el tipo activo es "pc" (online/offline/inactivo),
    // uno de los 7 manuales (activo/en_reparación/dado_de_baja), o ninguno
    // (ambos mundos a la vez, donde un solo selector de estado no tiene
    // sentido — ver el <select> de estado más abajo).
    if (patch.tipo !== undefined) next.estado = '';
    setFilters(next);
    load(next);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await inventoryApi.exportExcel(buildApiFilters(filters));
    } finally {
      setExporting(false);
    }
  }

  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'Exportando...' : 'Exportar'}
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Nuevo equipo
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleFilterChange({ search: e.target.value })}
          placeholder="Buscar por nombre, marca, modelo, ubicación..."
          className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        />
        <select
          value={filters.tipo}
          onChange={(e) => handleFilterChange({ tipo: e.target.value })}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
        >
          <option value="">Todo tipo</option>
          <option value="pc">PC (agente)</option>
          {(Object.keys(TIPO_LABELS) as InventoryEquipmentType[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_LABELS[t]}
            </option>
          ))}
        </select>
        {/* El vocabulario de estado depende del tipo elegido — con "todo tipo"
            no hay un único vocabulario válido, así que el filtro se oculta en
            vez de forzar una lista que solo aplicaría a la mitad de las filas. */}
        {filters.tipo === 'pc' ? (
          <select
            value={filters.estado}
            onChange={(e) => handleFilterChange({ estado: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todo estado</option>
            {(Object.keys(DEVICE_ESTADO_LABELS) as DeviceStatus[]).map((e) => (
              <option key={e} value={e}>
                {DEVICE_ESTADO_LABELS[e]}
              </option>
            ))}
          </select>
        ) : (
          filters.tipo && (
            <select
              value={filters.estado}
              onChange={(e) => handleFilterChange({ estado: e.target.value })}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
            >
              <option value="">Todo estado</option>
              {(Object.keys(ESTADO_LABELS) as InventoryEquipmentStatus[]).map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABELS[e]}
                </option>
              ))}
            </select>
          )
        )}
        {isAdmin && (
          <select
            value={filters.empresaId}
            onChange={(e) => handleFilterChange({ empresaId: e.target.value })}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
          >
            <option value="">Toda empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}
        {(filters.tipo || filters.estado || filters.empresaId || filters.search) && (
          <button onClick={() => handleFilterChange(EMPTY_FILTERS)} className="text-xs text-gray-500 hover:underline">
            Limpiar filtros
          </button>
        )}
      </div>

      {showCreateModal && (
        <InventoryFormModal
          onClose={() => setShowCreateModal(false)}
          onSaved={(item) => {
            setItems((prev) => [{ origen: 'manual', equipment: item }, ...prev]);
            setShowCreateModal(false);
          }}
        />
      )}

      {loading ? (
        <p className="text-gray-500">Cargando inventario...</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500">No hay equipo registrado.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Equipo</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Marca / Modelo / SO</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ubicación / Info</th>
                {isAdmin && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Empresa</th>}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((row) => {
                if (row.origen === 'agente') {
                  const device = row.device;
                  return (
                    <tr
                      key={`device-${device.id}`}
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
                            <p className="text-xs text-gray-400">PC (agente)</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {[device.so, device.versionSo].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{datosDisponibles(device)}</td>
                      {isAdmin && <td className="px-4 py-3 text-gray-500">{device.empresa?.nombre ?? '—'}</td>}
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'rounded-full px-2 py-1 text-xs font-medium',
                            DEVICE_ESTADO_STYLES[device.estado],
                          )}
                        >
                          {DEVICE_ESTADO_LABELS[device.estado]}
                        </span>
                      </td>
                    </tr>
                  );
                }

                const item = row.equipment;
                const Icon = TIPO_ICONS[item.tipo];
                return (
                  <tr
                    key={`equipment-${item.id}`}
                    onClick={() => navigate(`/inventory/${item.id}`)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <Icon size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{item.nombre}</p>
                          <p className="text-xs text-gray-400">{TIPO_LABELS[item.tipo]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {[item.marca, item.modelo].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.ubicacion ?? '—'}</td>
                    {isAdmin && <td className="px-4 py-3 text-gray-500">{item.empresa?.nombre ?? '—'}</td>}
                    <td className="px-4 py-3">
                      <span className={clsx('rounded-full px-2 py-1 text-xs font-medium', ESTADO_STYLES[item.estado])}>
                        {ESTADO_LABELS[item.estado]}
                      </span>
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
