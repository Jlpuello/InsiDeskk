import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Eye, EyeOff, FileDown, KeyRound, Pencil, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { inventoryApi } from '../api/inventory.api.ts';
import { InventoryFormModal } from './InventoryFormModal.tsx';
import type { InventoryEquipment, InventoryEquipmentStatus, InventoryEquipmentType } from '../types/inventory.types.ts';

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

const ESTADO_STYLES: Record<InventoryEquipmentStatus, string> = {
  activo: 'bg-green-100 text-green-800',
  en_reparacion: 'bg-amber-100 text-amber-800',
  dado_de_baja: 'bg-gray-100 text-gray-800',
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-800">{value}</dd>
    </div>
  );
}

export function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryEquipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function load() {
    if (!id) return;
    setLoading(true);
    inventoryApi
      .getById(id)
      .then(setItem)
      .catch(() => setError('No se pudo cargar el equipo'))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  async function handleDelete() {
    if (!item || !confirm(`¿Eliminar "${item.nombre}" del inventario? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    try {
      await inventoryApi.remove(item.id);
      navigate('/inventory');
    } catch {
      setError('No se pudo eliminar el equipo');
      setDeleting(false);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Cargando equipo...</p>;
  if (error || !item) return <p className="p-6 text-red-600">{error ?? 'Equipo no encontrado'}</p>;

  const atributos = item.atributos ?? {};

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link to="/inventory" className="text-xs text-gray-400 hover:underline">
            ← Inventario
          </Link>
          <h1 className="text-xl font-semibold">{item.nombre}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/inventory/${item.id}/report`}
            target="_blank"
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FileDown size={14} />
            Ficha PDF
          </Link>
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Pencil size={14} />
            Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>

      {showEditModal && (
        <InventoryFormModal
          equipment={item}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setItem(updated);
            setShowEditModal(false);
          }}
        />
      )}

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">{TIPO_LABELS[item.tipo]}</span>
          <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', ESTADO_STYLES[item.estado])}>
            {ESTADO_LABELS[item.estado]}
          </span>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <Field label="Empresa" value={item.empresa?.nombre ?? '—'} />
          <Field label="Marca" value={item.marca ?? '—'} />
          <Field label="Modelo" value={item.modelo ?? '—'} />
          <Field label="N° de serie" value={item.numeroSerie ?? '—'} />
          <Field label="IP" value={item.ipAddress ?? '—'} />
          <Field label="MAC" value={item.macAddress ?? '—'} />
          <Field label="Ubicación" value={item.ubicacion ?? '—'} />
          <Field label="Proveedor" value={item.proveedor ?? '—'} />
          <Field
            label="Fecha de compra"
            value={item.fechaCompra ? new Date(item.fechaCompra).toLocaleDateString('es-ES') : '—'}
          />
          <Field
            label="Garantía vence"
            value={item.garantiaVence ? new Date(item.garantiaVence).toLocaleDateString('es-ES') : '—'}
          />
        </dl>

        {Object.keys(atributos).length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium uppercase text-gray-400">Características</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              {Object.entries(atributos).map(([key, value]) => (
                <Field key={key} label={key} value={String(value)} />
              ))}
            </dl>
          </div>
        )}

        {item.notas && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-gray-400">Notas</p>
            <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">{item.notas}</p>
          </div>
        )}
      </div>

      {(item.credencialUsuario || item.credencialPassword || item.notasConfiguracion) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-6">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
            <KeyRound size={14} />
            Credenciales de administración
            <span className="font-normal normal-case text-amber-600">
              (visibles solo acá dentro del sistema — nunca en exportaciones)
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Field label="Usuario" value={item.credencialUsuario ?? '—'} />
            <div>
              <dt className="text-gray-400">Contraseña</dt>
              <dd className="flex items-center gap-1.5 text-gray-800">
                {item.credencialPassword ? (showPassword ? item.credencialPassword : '••••••••') : '—'}
                {item.credencialPassword && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </dd>
            </div>
          </dl>
          {item.notasConfiguracion && (
            <div className="mt-3">
              <dt className="text-xs text-gray-400">Notas de configuración</dt>
              <dd className="whitespace-pre-wrap text-sm text-gray-800">{item.notasConfiguracion}</dd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
