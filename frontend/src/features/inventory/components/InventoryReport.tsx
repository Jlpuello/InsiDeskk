import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { inventoryApi } from '../api/inventory.api.ts';
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="text-sm text-gray-900">{value}</dd>
    </div>
  );
}

// Mismo patrón que TicketReport: vista standalone pensada para imprimir o
// "Guardar como PDF" desde el navegador, sin depender de generación de PDF en
// el servidor. A propósito NO incluye credenciales/notas de configuración —
// mismo criterio que el export a Excel (ver inventory-export.service.ts en
// el backend): un archivo que sale del sistema no debería llevarlas.
export function InventoryReport() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<InventoryEquipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    inventoryApi
      .getById(id)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el equipo');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="p-6 text-gray-500">Cargando ficha...</p>;
  if (error || !item) return <p className="p-6 text-red-600">{error ?? 'Equipo no encontrado'}</p>;

  const atributos = item.atributos ?? {};

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-xs text-gray-400">Ficha de equipo — vista de impresión</p>
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
        <h1 className="text-xl font-semibold text-gray-900">{item.nombre}</h1>
        <p className="mt-1 text-xs text-gray-400">
          {TIPO_LABELS[item.tipo]} · Generado el {new Date().toLocaleString('es-ES')}
        </p>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Empresa" value={item.empresa?.nombre ?? '—'} />
        <Field label="Tipo" value={TIPO_LABELS[item.tipo]} />
        <Field label="Estado" value={ESTADO_LABELS[item.estado]} />
        <Field label="Marca" value={item.marca ?? '—'} />
        <Field label="Modelo" value={item.modelo ?? '—'} />
        <Field label="N° de serie" value={item.numeroSerie ?? '—'} />
        <Field label="IP" value={item.ipAddress ?? '—'} />
        <Field label="MAC" value={item.macAddress ?? '—'} />
        <Field label="Ubicación" value={item.ubicacion ?? '—'} />
        <Field label="Proveedor" value={item.proveedor ?? '—'} />
        <Field label="Fecha de compra" value={item.fechaCompra ? new Date(item.fechaCompra).toLocaleDateString('es-ES') : '—'} />
        <Field label="Garantía vence" value={item.garantiaVence ? new Date(item.garantiaVence).toLocaleDateString('es-ES') : '—'} />
      </dl>

      {Object.keys(atributos).length > 0 && (
        <div className="mb-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">Características</p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {Object.entries(atributos).map(([key, value]) => (
              <Field key={key} label={key} value={String(value)} />
            ))}
          </dl>
        </div>
      )}

      {item.notas && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Notas</p>
          <p className="whitespace-pre-wrap text-sm text-gray-800">{item.notas}</p>
        </div>
      )}
    </div>
  );
}
