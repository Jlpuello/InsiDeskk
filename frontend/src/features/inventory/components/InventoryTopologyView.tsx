import { Camera, Fingerprint, Laptop, Network, Printer, Router, Video, Wifi } from 'lucide-react';
import type { InventoryEquipmentType, InventoryListItem } from '../types/inventory.types.ts';

// Vista visual de lo que ya existe en Inventario, agrupada por empresa — NO
// es un editor de topología de red: no hay datos de puerto/cableado en el
// modelo (InventoryEquipment no tiene nada de eso, ver schema.prisma), así
// que acá no se inventan conexiones específicas entre equipos. Cada equipo
// se muestra conectado a un único nodo "Red de {empresa}" (un bus simple),
// que es lo único que realmente sabemos: que todos pertenecen a esa empresa.

type NodeType = InventoryEquipmentType | 'pc';

const TIPO_ORDER: NodeType[] = ['router', 'switch', 'access_point', 'control_acceso', 'camara_ip', 'dvr', 'impresora', 'pc'];

const TIPO_LABELS: Record<NodeType, string> = {
  router: 'Router',
  switch: 'Switch',
  access_point: 'Access Point',
  control_acceso: 'Control de acceso',
  camara_ip: 'Cámara IP',
  dvr: 'DVR',
  impresora: 'Impresora',
  pc: 'Equipo con agente',
};

const TIPO_ICONS: Record<NodeType, typeof Router> = {
  router: Router,
  switch: Network,
  access_point: Wifi,
  control_acceso: Fingerprint,
  camara_ip: Camera,
  dvr: Video,
  impresora: Printer,
  pc: Laptop,
};

// Mismo chip de 2 letras + color por tipo que se mostró en el mockup
// aprobado — un color por TIPO (identidad), un borde por ESTADO (semáforo).
const TIPO_CHIP: Record<NodeType, { label: string; color: string }> = {
  router: { label: 'RT', color: '#4338ca' },
  switch: { label: 'SW', color: '#2563eb' },
  access_point: { label: 'AP', color: '#7c3aed' },
  control_acceso: { label: 'CA', color: '#0891b2' },
  camara_ip: { label: 'CM', color: '#e11d48' },
  dvr: { label: 'DV', color: '#e11d48' },
  impresora: { label: 'IM', color: '#475569' },
  pc: { label: 'PC', color: '#0d9488' },
};

const ESTADO_COLOR: Record<string, string> = {
  activo: '#16a34a',
  online: '#16a34a',
  en_reparacion: '#d97706',
  inactivo: '#d97706',
  dado_de_baja: '#9ca3af',
  offline: '#9ca3af',
};

// activo/online, en_reparacion/inactivo y dado_de_baja/offline son pares de
// enums distintos (InventoryEquipmentStatus vs DeviceStatus) que significan
// lo mismo visualmente — la leyenda los agrupa bajo un único label en vez de
// mostrar "Activo" duplicado.
function estadoLabel(estado: string): string {
  if (estado === 'activo' || estado === 'online') return 'Activo';
  if (estado === 'dado_de_baja' || estado === 'offline') return 'Fuera de línea';
  return 'En reparación';
}

interface TopologyNode {
  id: string;
  tipo: NodeType;
  nombre: string;
  subtitle: string;
  estado: string;
  onClick: () => void;
}

interface InventoryTopologyViewProps {
  items: InventoryListItem[];
  empresaNombre: string;
  onOpenEquipment: (id: string) => void;
  onOpenDevice: (id: string) => void;
}

export function InventoryTopologyView({ items, empresaNombre, onOpenEquipment, onOpenDevice }: InventoryTopologyViewProps) {
  const nodes: TopologyNode[] = items
    .map((row): TopologyNode => {
      if (row.origen === 'agente') {
        const d = row.device;
        return {
          id: `device-${d.id}`,
          tipo: 'pc',
          nombre: d.nombre,
          subtitle: [d.so, d.versionSo].filter(Boolean).join(' · ') || 'PC con agente',
          estado: d.estado,
          onClick: () => onOpenDevice(d.id),
        };
      }
      const e = row.equipment;
      return {
        id: `equipment-${e.id}`,
        tipo: e.tipo,
        nombre: e.nombre,
        subtitle: [e.marca, e.modelo].filter(Boolean).join(' · ') || e.ubicacion || TIPO_LABELS[e.tipo],
        estado: e.estado,
        onClick: () => onOpenEquipment(e.id),
      };
    })
    .sort((a, b) => TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo));

  const tiposPresentes = TIPO_ORDER.filter((t) => nodes.some((n) => n.tipo === t));
  const estadosPresentes = Array.from(
    new Map(
      nodes.filter((n) => ESTADO_COLOR[n.estado]).map((n) => [estadoLabel(n.estado), ESTADO_COLOR[n.estado]]),
    ).entries(),
  );

  if (nodes.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-300 shadow-sm">
          <Network size={18} />
        </span>
        <p className="text-sm text-gray-400">Todavía no hay equipos cargados para esta empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5">
        <span className="text-xs font-semibold text-gray-500">Tipo</span>
        {tiposPresentes.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold text-white"
              style={{ background: TIPO_CHIP[t].color }}
            >
              {TIPO_CHIP[t].label}
            </span>
            {TIPO_LABELS[t]}
          </span>
        ))}
        <span className="h-4 w-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-500">Estado</span>
        {estadosPresentes.map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-10">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
            <Network size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Red de {empresaNombre}</span>
          </div>
          <div className="h-6 w-0.5 bg-gray-300" />

          <div className="relative w-full">
            <div className="absolute inset-x-[8%] top-0 h-0.5 bg-gray-300" />
            <div className="flex flex-wrap justify-center gap-5 pt-0">
              {nodes.map((n) => {
                const Icon = TIPO_ICONS[n.tipo];
                return (
                  <div key={n.id} className="flex flex-col items-center">
                    <div className="h-6 w-0.5 bg-gray-300" />
                    <button
                      onClick={n.onClick}
                      className="flex w-44 items-center gap-2.5 rounded-lg border bg-white p-3 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                      style={{ borderLeftWidth: 4, borderLeftColor: ESTADO_COLOR[n.estado] ?? '#e5e7eb', borderTopColor: '#e5e7eb', borderRightColor: '#e5e7eb', borderBottomColor: '#e5e7eb' }}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
                        style={{ background: TIPO_CHIP[n.tipo].color }}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{n.nombre}</span>
                        <span className="block truncate text-xs text-gray-400">{n.subtitle}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
