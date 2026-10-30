import { useState } from 'react';
import { Camera, Fingerprint, Laptop, Network, Printer, Router, Video, Wifi } from 'lucide-react';
import { inventoryApi } from '../api/inventory.api.ts';
import { deviceApi } from '../../devices/api/device.api.ts';
import type { InventoryEquipmentType, InventoryListItem } from '../types/inventory.types.ts';

// Árbol editable del Mapa de Inventario — a diferencia de la primera versión
// (un simple "bus" con todo colgado de un único nodo), esto refleja de
// verdad InventoryEquipment.conectadoAId / Device.conectadoAId: cada equipo
// cuelga del que se elija en su propio selector "Conectado a", y quien no
// tiene padre cuelga directo de "Red de {empresa}" (el router, típicamente).
// Los PCs con agente nunca pueden ser padre de otra cosa (son siempre hoja),
// así que su selector solo ofrece equipos, nunca otros PCs.

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
  kind: 'equipment' | 'device';
  realId: string;
  tipo: NodeType;
  nombre: string;
  subtitle: string;
  ip: string | null;
  estado: string;
  conectadoAId: string | null;
  onClick: () => void;
}

function sortNodes(a: TopologyNode, b: TopologyNode): number {
  return TIPO_ORDER.indexOf(a.tipo) - TIPO_ORDER.indexOf(b.tipo) || a.nombre.localeCompare(b.nombre);
}

interface InventoryTopologyViewProps {
  items: InventoryListItem[];
  empresaNombre: string;
  onOpenEquipment: (id: string) => void;
  onOpenDevice: (id: string) => void;
  // Para refrescar la lista después de cambiar una conexión (el selector
  // "Conectado a" persiste contra el backend y luego necesita el dato
  // fresco para redibujar el árbol).
  onReload: () => void;
}

export function InventoryTopologyView({ items, empresaNombre, onOpenEquipment, onOpenDevice, onReload }: InventoryTopologyViewProps) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [connError, setConnError] = useState<string | null>(null);

  const allNodes: TopologyNode[] = items.map((row): TopologyNode => {
    if (row.origen === 'agente') {
      const d = row.device;
      return {
        id: `device-${d.id}`,
        kind: 'device',
        realId: d.id,
        tipo: 'pc',
        nombre: d.nombre,
        subtitle: [d.so, d.versionSo].filter(Boolean).join(' · ') || 'PC con agente',
        ip: d.ipLocal || d.ipPublica || null,
        estado: d.estado,
        conectadoAId: d.conectadoAId ?? null,
        onClick: () => onOpenDevice(d.id),
      };
    }
    const e = row.equipment;
    return {
      id: `equipment-${e.id}`,
      kind: 'equipment',
      realId: e.id,
      tipo: e.tipo,
      nombre: e.nombre,
      subtitle: [e.marca, e.modelo].filter(Boolean).join(' · ') || e.ubicacion || TIPO_LABELS[e.tipo],
      ip: e.ipAddress ?? null,
      estado: e.estado,
      conectadoAId: e.conectadoAId ?? null,
      onClick: () => onOpenEquipment(e.id),
    };
  });

  const childrenOf = new Map<string, TopologyNode[]>();
  for (const n of allNodes) {
    if (!n.conectadoAId) continue;
    const list = childrenOf.get(n.conectadoAId) ?? [];
    list.push(n);
    childrenOf.set(n.conectadoAId, list);
  }
  for (const list of childrenOf.values()) list.sort(sortNodes);

  // Solo un InventoryEquipment puede ser padre (un Device siempre es hoja) —
  // las opciones del selector "Conectado a" salen de esta lista.
  const equipmentNodes = allNodes.filter((n) => n.kind === 'equipment').sort(sortNodes);

  function equipmentDescendantIds(realId: string, acc: Set<string> = new Set()): Set<string> {
    for (const child of childrenOf.get(realId) ?? []) {
      if (child.kind === 'equipment' && !acc.has(child.realId)) {
        acc.add(child.realId);
        equipmentDescendantIds(child.realId, acc);
      }
    }
    return acc;
  }

  // Raíces del árbol: equipos sin padre, cuelgan directo de "Red de
  // {empresa}" (el router, típicamente). Un Device sin padre no tiene dónde
  // colgar en el árbol (no puede ser hijo directo de "Red") — se muestra
  // aparte, en la bandeja "Sin conectar".
  const roots = allNodes.filter((n) => n.kind === 'equipment' && !n.conectadoAId).sort(sortNodes);
  const sinConectar = allNodes.filter((n) => n.kind === 'device' && !n.conectadoAId).sort(sortNodes);

  async function handleConnectionChange(node: TopologyNode, rawValue: string) {
    const conectadoAId = rawValue === '' ? null : rawValue;
    setSavingId(node.id);
    setConnError(null);
    try {
      if (node.kind === 'equipment') {
        await inventoryApi.updateConnection(node.realId, conectadoAId);
      } else {
        await deviceApi.updateConnection(node.realId, conectadoAId);
      }
      onReload();
    } catch {
      setConnError(`No se pudo reconectar "${node.nombre}". Puede que forme un ciclo o ya no exista.`);
    } finally {
      setSavingId(null);
    }
  }

  const tiposPresentes = TIPO_ORDER.filter((t) => allNodes.some((n) => n.tipo === t));
  const estadosPresentes = Array.from(
    new Map(
      allNodes.filter((n) => ESTADO_COLOR[n.estado]).map((n) => [estadoLabel(n.estado), ESTADO_COLOR[n.estado]]),
    ).entries(),
  );

  if (allNodes.length === 0) {
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

      {connError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{connError}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-10">
        <div className="flex min-w-fit flex-col items-center">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5">
            <Network size={16} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">Red de {empresaNombre}</span>
          </div>

          {roots.length > 0 && (
            <>
              <div className="h-5 w-px bg-gray-300" />
              <div className="flex gap-6">
                {roots.map((node) => (
                  <ChildSlot key={node.id}>
                    <TreeNode
                      node={node}
                      childrenOf={childrenOf}
                      equipmentNodes={equipmentNodes}
                      equipmentDescendantIds={equipmentDescendantIds}
                      empresaNombre={empresaNombre}
                      savingId={savingId}
                      onConnectionChange={handleConnectionChange}
                    />
                  </ChildSlot>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {sinConectar.length > 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-semibold text-gray-500">
            Sin conectar — todavía no se indicó a qué equipo están conectados
          </p>
          <div className="flex flex-wrap gap-3">
            {sinConectar.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                equipmentNodes={equipmentNodes}
                equipmentDescendantIds={equipmentDescendantIds}
                empresaNombre={empresaNombre}
                savingId={savingId}
                onConnectionChange={handleConnectionChange}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Envuelve cada hijo de una misma fila con la línea de bus horizontal (medio
// izquierdo/derecho vía pseudo-elementos, ocultos en el primero/último) + el
// tick vertical hacia su tarjeta — técnica CSS estándar de árbol/organigrama,
// funciona para cualquier cantidad de hermanos sin calcular píxeles a mano.
function ChildSlot({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex flex-col items-center pt-5 before:absolute before:top-0 before:left-0 before:right-1/2 before:h-px before:bg-gray-300 before:content-[''] after:absolute after:top-0 after:left-1/2 after:right-0 after:h-px after:bg-gray-300 after:content-[''] first:before:bg-transparent last:after:bg-transparent"
    >
      <div className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 bg-gray-300" />
      {children}
    </div>
  );
}

interface TreeNodeProps {
  node: TopologyNode;
  childrenOf: Map<string, TopologyNode[]>;
  equipmentNodes: TopologyNode[];
  equipmentDescendantIds: (realId: string) => Set<string>;
  empresaNombre: string;
  savingId: string | null;
  onConnectionChange: (node: TopologyNode, rawValue: string) => void;
}

function TreeNode({ node, childrenOf, equipmentNodes, equipmentDescendantIds, empresaNombre, savingId, onConnectionChange }: TreeNodeProps) {
  const kids = childrenOf.get(node.realId) ?? [];

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        equipmentNodes={equipmentNodes}
        equipmentDescendantIds={equipmentDescendantIds}
        empresaNombre={empresaNombre}
        savingId={savingId}
        onConnectionChange={onConnectionChange}
      />

      {kids.length > 0 && (
        <>
          <div className="h-5 w-px bg-gray-300" />
          <div className="flex gap-6">
            {kids.map((child) => (
              <ChildSlot key={child.id}>
                <TreeNode
                  node={child}
                  childrenOf={childrenOf}
                  equipmentNodes={equipmentNodes}
                  equipmentDescendantIds={equipmentDescendantIds}
                  empresaNombre={empresaNombre}
                  savingId={savingId}
                  onConnectionChange={onConnectionChange}
                />
              </ChildSlot>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface NodeCardProps {
  node: TopologyNode;
  equipmentNodes: TopologyNode[];
  equipmentDescendantIds: (realId: string) => Set<string>;
  empresaNombre: string;
  savingId: string | null;
  onConnectionChange: (node: TopologyNode, rawValue: string) => void;
}

function NodeCard({ node, equipmentNodes, equipmentDescendantIds, empresaNombre, savingId, onConnectionChange }: NodeCardProps) {
  const Icon = TIPO_ICONS[node.tipo];
  const excluded = node.kind === 'equipment' ? equipmentDescendantIds(node.realId) : new Set<string>();
  const options = equipmentNodes.filter((o) => o.realId !== node.realId && !excluded.has(o.realId));
  const isSaving = savingId === node.id;

  return (
    <div
      className="w-48 overflow-hidden rounded-lg border bg-white shadow-sm"
      style={{ borderLeftWidth: 4, borderLeftColor: ESTADO_COLOR[node.estado] ?? '#e5e7eb', borderTopColor: '#e5e7eb', borderRightColor: '#e5e7eb', borderBottomColor: '#e5e7eb' }}
    >
      <button onClick={node.onClick} className="flex w-full items-center gap-2.5 p-3 text-left transition-colors hover:bg-blue-50/30">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white"
          style={{ background: TIPO_CHIP[node.tipo].color }}
        >
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-gray-900">{node.nombre}</span>
          <span className="block truncate text-xs text-gray-400">{node.subtitle}</span>
        </span>
      </button>

      {node.ip && (
        <div className="px-3 pb-2">
          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600">
            {node.ip}
          </span>
        </div>
      )}

      <label className="flex items-center gap-1 border-t border-gray-100 px-2.5 py-1.5 text-[10px] text-gray-400">
        Conectado a
        <select
          value={node.conectadoAId ?? ''}
          disabled={isSaving}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onConnectionChange(node, e.target.value)}
          className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-white px-1 py-0.5 text-[11px] text-gray-700 disabled:opacity-50"
        >
          <option value="">{node.kind === 'equipment' ? `Red de ${empresaNombre}` : 'Sin conectar'}</option>
          {options.map((o) => (
            <option key={o.realId} value={o.realId}>
              {o.nombre}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
