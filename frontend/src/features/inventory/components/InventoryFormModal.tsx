import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import clsx from 'clsx';
import { Modal } from '../../../shared/components/Modal.tsx';
import { inventoryApi } from '../api/inventory.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type {
  InventoryEquipment,
  InventoryEquipmentStatus,
  InventoryEquipmentType,
} from '../types/inventory.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';

const TIPO_LABELS: Record<InventoryEquipmentType, string> = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Access Point',
  impresora: 'Impresora',
  dvr: 'DVR',
  camara_ip: 'Cámara IP',
  control_acceso: 'Control de acceso',
};

const ESTADO_LABELS: Record<InventoryEquipmentStatus, string> = {
  activo: 'Activo',
  en_reparacion: 'En reparación',
  dado_de_baja: 'Dado de baja',
};

interface InventoryFormModalProps {
  equipment?: InventoryEquipment;
  onClose: () => void;
  onSaved: (item: InventoryEquipment) => void;
}

// Atributos específicos por tipo — ver InventoryEquipment.atributos (JSON
// libre en el backend). Solo se muestran los campos relevantes al tipo
// elegido; el resto de `atributos` no se toca.
function AtributosFields({
  tipo,
  atributos,
  onChange,
}: {
  tipo: InventoryEquipmentType;
  atributos: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...atributos, [key]: value });
  }

  if (tipo === 'switch') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>Puertos</label>
          <input
            type="number"
            min={1}
            value={(atributos.puertos as number) ?? ''}
            onChange={(e) => set('puertos', e.target.value ? Number(e.target.value) : undefined)}
            className={inputClasses}
          />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={!!atributos.poe}
            onChange={(e) => set('poe', e.target.checked)}
            className="rounded border-gray-300"
          />
          Con PoE
        </label>
      </div>
    );
  }

  if (tipo === 'access_point') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>SSID</label>
          <input
            type="text"
            value={(atributos.ssid as string) ?? ''}
            onChange={(e) => set('ssid', e.target.value)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Banda</label>
          <select
            value={(atributos.banda as string) ?? ''}
            onChange={(e) => set('banda', e.target.value)}
            className={inputClasses}
          >
            <option value="">—</option>
            <option value="2.4GHz">2.4 GHz</option>
            <option value="5GHz">5 GHz</option>
            <option value="dual">Dual band</option>
          </select>
        </div>
      </div>
    );
  }

  if (tipo === 'dvr' || tipo === 'camara_ip') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>Canales</label>
          <input
            type="number"
            min={1}
            value={(atributos.canales as number) ?? ''}
            onChange={(e) => set('canales', e.target.value ? Number(e.target.value) : undefined)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Resolución</label>
          <input
            type="text"
            placeholder="1080p, 4K..."
            value={(atributos.resolucion as string) ?? ''}
            onChange={(e) => set('resolucion', e.target.value)}
            className={inputClasses}
          />
        </div>
      </div>
    );
  }

  if (tipo === 'control_acceso') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>Puertas controladas</label>
          <input
            type="number"
            min={1}
            value={(atributos.puertas as number) ?? ''}
            onChange={(e) => set('puertas', e.target.value ? Number(e.target.value) : undefined)}
            className={inputClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Capacidad de usuarios</label>
          <input
            type="number"
            min={1}
            value={(atributos.capacidadUsuarios as number) ?? ''}
            onChange={(e) => set('capacidadUsuarios', e.target.value ? Number(e.target.value) : undefined)}
            className={inputClasses}
          />
        </div>
      </div>
    );
  }

  return null;
}

export function InventoryFormModal({ equipment, onClose, onSaved }: InventoryFormModalProps) {
  const rol = useAuthStore((state) => state.user?.rol);
  const authEmpresaId = useAuthStore((state) => state.user?.empresaId);
  const isAdmin = rol === 'admin';
  const isEdit = !!equipment;

  const [empresaId, setEmpresaId] = useState(equipment?.empresaId ?? '');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tipo, setTipo] = useState<InventoryEquipmentType>(equipment?.tipo ?? 'router');
  const [nombre, setNombre] = useState(equipment?.nombre ?? '');
  const [marca, setMarca] = useState(equipment?.marca ?? '');
  const [modelo, setModelo] = useState(equipment?.modelo ?? '');
  const [numeroSerie, setNumeroSerie] = useState(equipment?.numeroSerie ?? '');
  const [ipAddress, setIpAddress] = useState(equipment?.ipAddress ?? '');
  const [macAddress, setMacAddress] = useState(equipment?.macAddress ?? '');
  const [ubicacion, setUbicacion] = useState(equipment?.ubicacion ?? '');
  const [proveedor, setProveedor] = useState(equipment?.proveedor ?? '');
  const [fechaCompra, setFechaCompra] = useState(equipment?.fechaCompra?.slice(0, 10) ?? '');
  const [garantiaVence, setGarantiaVence] = useState(equipment?.garantiaVence?.slice(0, 10) ?? '');
  const [estado, setEstado] = useState<InventoryEquipmentStatus>(equipment?.estado ?? 'activo');
  const [credencialUsuario, setCredencialUsuario] = useState(equipment?.credencialUsuario ?? '');
  const [credencialPassword, setCredencialPassword] = useState(equipment?.credencialPassword ?? '');
  const [showPassword, setShowPassword] = useState(false);
  const [notasConfiguracion, setNotasConfiguracion] = useState(equipment?.notasConfiguracion ?? '');
  const [notas, setNotas] = useState(equipment?.notas ?? '');
  const [atributos, setAtributos] = useState<Record<string, unknown>>(equipment?.atributos ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin && !isEdit) {
      companyApi.list().then(setCompanies).catch(() => setCompanies([]));
    }
  }, [isAdmin, isEdit]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveEmpresaId = isAdmin ? empresaId : authEmpresaId;
    if (!isEdit && !effectiveEmpresaId) {
      setError('Elegí una empresa');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        tipo,
        nombre,
        marca: marca || undefined,
        modelo: modelo || undefined,
        numeroSerie: numeroSerie || undefined,
        ipAddress: ipAddress || undefined,
        macAddress: macAddress || undefined,
        ubicacion: ubicacion || undefined,
        proveedor: proveedor || undefined,
        fechaCompra: fechaCompra || undefined,
        garantiaVence: garantiaVence || undefined,
        estado,
        credencialUsuario: credencialUsuario || undefined,
        credencialPassword: credencialPassword || undefined,
        notasConfiguracion: notasConfiguracion || undefined,
        notas: notas || undefined,
        atributos: Object.keys(atributos).length > 0 ? atributos : undefined,
      };

      const item = isEdit
        ? await inventoryApi.update(equipment.id, payload)
        : await inventoryApi.create({ ...payload, empresaId: effectiveEmpresaId! });
      onSaved(item);
    } catch {
      setError('No se pudo guardar el equipo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Editar equipo' : 'Nuevo equipo de inventario'}
      subtitle="Router, switch, AP, impresora, DVR, cámara IP o control de acceso"
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as InventoryEquipmentType)}
              disabled={isEdit}
              className={inputClasses}
            >
              {(Object.keys(TIPO_LABELS) as InventoryEquipmentType[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {isAdmin && !isEdit ? (
            <div>
              <label className={labelClasses}>Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={inputClasses}>
                <option value="">Elegir...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className={labelClasses}>Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as InventoryEquipmentStatus)}
                className={inputClasses}
              >
                {(Object.keys(ESTADO_LABELS) as InventoryEquipmentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isAdmin && !isEdit && (
          <div>
            <label className={labelClasses}>Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as InventoryEquipmentStatus)}
              className={inputClasses}
            >
              {(Object.keys(ESTADO_LABELS) as InventoryEquipmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {ESTADO_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClasses}>Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            minLength={2}
            placeholder="Ej: Router sede principal"
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Marca</label>
            <input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Modelo</label>
            <input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClasses}>N° de serie</label>
            <input
              type="text"
              value={numeroSerie}
              onChange={(e) => setNumeroSerie(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>IP</label>
            <input
              type="text"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              placeholder="192.168.1.1"
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>MAC</label>
            <input
              type="text"
              value={macAddress}
              onChange={(e) => setMacAddress(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF"
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Ubicación</label>
            <input
              type="text"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Rack piso 2, recepción..."
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Proveedor</label>
            <input
              type="text"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Fecha de compra</label>
            <input
              type="date"
              value={fechaCompra}
              onChange={(e) => setFechaCompra(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Garantía vence</label>
            <input
              type="date"
              value={garantiaVence}
              onChange={(e) => setGarantiaVence(e.target.value)}
              className={inputClasses}
            />
          </div>
        </div>

        {(tipo === 'switch' || tipo === 'access_point' || tipo === 'dvr' || tipo === 'camara_ip' || tipo === 'control_acceso') && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Características de {TIPO_LABELS[tipo].toLowerCase()}
            </p>
            <AtributosFields tipo={tipo} atributos={atributos} onChange={setAtributos} />
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <KeyRound size={14} />
            Credenciales de administración
            <span className="font-normal normal-case text-amber-600">(cifradas, nunca salen en exportaciones)</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClasses}>Usuario</label>
              <input
                type="text"
                autoComplete="off"
                value={credencialUsuario}
                onChange={(e) => setCredencialUsuario(e.target.value)}
                className={clsx(inputClasses, 'bg-white')}
              />
            </div>
            <div>
              <label className={labelClasses}>Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={credencialPassword}
                  onChange={(e) => setCredencialPassword(e.target.value)}
                  className={clsx(inputClasses, 'bg-white pr-9')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className={labelClasses}>Notas de configuración</label>
            <textarea
              value={notasConfiguracion}
              onChange={(e) => setNotasConfiguracion(e.target.value)}
              rows={2}
              placeholder="VLANs, SNMP, reglas de port-forwarding..."
              className={clsx(inputClasses, 'bg-white')}
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Notas generales</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={inputClasses} />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || nombre.trim().length < 2}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear equipo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
