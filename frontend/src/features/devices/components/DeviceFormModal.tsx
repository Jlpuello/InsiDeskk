import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../../shared/components/Modal.tsx';
import { deviceApi } from '../api/device.api.ts';
import { companyApi } from '../../companies/api/company.api.ts';
import { useAuthStore } from '../../auth/store/auth.store.ts';
import type { Device, OperatingSystem } from '../types/device.types.ts';
import type { Company } from '../../companies/types/company.types.ts';

const inputClasses =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const labelClasses = 'mb-1 block text-sm font-medium text-gray-700';

const SO_OPTIONS: OperatingSystem[] = ['Windows', 'Linux', 'MacOS'];

interface DeviceFormModalProps {
  device?: Device;
  onClose: () => void;
  onSaved: (device: Device) => void;
}

// Alta/edición manual — la mayoría de los equipos llegan solos vía el
// agente/Remotely (ver DeviceDetail), esto cubre el caso de una PC sin
// agente que igual se quiere llevar en el sistema. Mismo patrón que
// InventoryFormModal (empresa fija para cliente/tecnico, elegible para admin).
export function DeviceFormModal({ device, onClose, onSaved }: DeviceFormModalProps) {
  const rol = useAuthStore((state) => state.user?.rol);
  const authEmpresaId = useAuthStore((state) => state.user?.empresaId);
  const isAdmin = rol === 'admin';
  const isEdit = !!device;

  const [empresaId, setEmpresaId] = useState(device?.empresaId ?? '');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [nombre, setNombre] = useState(device?.nombre ?? '');
  const [hostname, setHostname] = useState(device?.hostname ?? '');
  const [so, setSo] = useState<OperatingSystem | ''>(device?.so ?? '');
  const [versionSo, setVersionSo] = useState(device?.versionSo ?? '');
  const [ipLocal, setIpLocal] = useState(device?.ipLocal ?? '');
  const [ipPublica, setIpPublica] = useState(device?.ipPublica ?? '');
  const [cpuCores, setCpuCores] = useState(device?.cpuCores?.toString() ?? '');
  const [ramGb, setRamGb] = useState(device?.ramGb?.toString() ?? '');
  const [discoGb, setDiscoGb] = useState(device?.discoGb?.toString() ?? '');
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
        nombre,
        hostname: hostname || undefined,
        so: so || undefined,
        versionSo: versionSo || undefined,
        ipLocal: ipLocal || undefined,
        ipPublica: ipPublica || undefined,
        cpuCores: cpuCores ? Number(cpuCores) : undefined,
        ramGb: ramGb ? Number(ramGb) : undefined,
        discoGb: discoGb ? Number(discoGb) : undefined,
      };

      const saved = isEdit
        ? await deviceApi.update(device.id, payload)
        : await deviceApi.create({ ...payload, empresaId: effectiveEmpresaId! });
      onSaved(saved);
    } catch {
      setError('No se pudo guardar el dispositivo');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? 'Editar dispositivo' : 'Nuevo dispositivo'}
      subtitle="Alta manual — un PC con agente se registra solo al instalarlo"
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isAdmin && !isEdit && (
          <div>
            <label className={labelClasses}>Empresa</label>
            <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={inputClasses}>
              <option value="">Elegí una empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
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
            className={inputClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Hostname</label>
            <input type="text" value={hostname} onChange={(e) => setHostname(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Sistema operativo</label>
            <select value={so} onChange={(e) => setSo(e.target.value as OperatingSystem | '')} className={inputClasses}>
              <option value="">Sin especificar</option>
              {SO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClasses}>Versión del SO</label>
            <input type="text" value={versionSo} onChange={(e) => setVersionSo(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>IP local</label>
            <input type="text" value={ipLocal} onChange={(e) => setIpLocal(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClasses}>IP pública</label>
            <input type="text" value={ipPublica} onChange={(e) => setIpPublica(e.target.value)} className={inputClasses} />
          </div>
          <div>
            <label className={labelClasses}>Núcleos CPU</label>
            <input
              type="number"
              min={1}
              value={cpuCores}
              onChange={(e) => setCpuCores(e.target.value)}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>RAM (GB)</label>
            <input type="number" min={1} value={ramGb} onChange={(e) => setRamGb(e.target.value)} className={inputClasses} />
          </div>
        </div>

        <div>
          <label className={labelClasses}>Disco (GB)</label>
          <input
            type="number"
            min={1}
            value={discoGb}
            onChange={(e) => setDiscoGb(e.target.value)}
            className={`${inputClasses} max-w-[calc(33%-0.5rem)]`}
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
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
