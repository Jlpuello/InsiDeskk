import type { Device, InventoryEquipmentStatus, InventoryEquipmentType } from '@prisma/client';

export interface CreateInventoryEquipmentDTO {
  empresaId: string;
  tipo: InventoryEquipmentType;
  nombre: string;
  marca?: string;
  modelo?: string;
  numeroSerie?: string;
  ipAddress?: string;
  macAddress?: string;
  ubicacion?: string;
  proveedor?: string;
  fechaCompra?: Date;
  garantiaVence?: Date;
  estado?: InventoryEquipmentStatus;
  credencialUsuario?: string;
  credencialPassword?: string;
  notasConfiguracion?: string;
  notas?: string;
  atributos?: Record<string, unknown>;
  // Árbol de conexión del Mapa — a qué otro equipo de la misma empresa está
  // conectado este. null = raíz (cuelga de "Red de {empresa}" en la UI).
  conectadoAId?: string | null;
}

export type UpdateInventoryEquipmentDTO = Partial<Omit<CreateInventoryEquipmentDTO, 'empresaId'>>;

export interface InventoryEquipmentFilters {
  empresaId?: string;
  tipo?: InventoryEquipmentType;
  estado?: InventoryEquipmentStatus;
  // Búsqueda libre por nombre/marca/modelo/ubicación — ver
  // inventory.repository.ts (no pasa por el middleware de cifrado, así que
  // solo puede tocar campos que se guardan en claro).
  search?: string;
}

// 'pc' es un pseudo-tipo — no existe en el enum de Prisma (InventoryEquipment
// no representa PCs), es la forma en que el filtro de "Inventario" pide "solo
// los equipos con agente" en vez de "solo equipo cargado a mano". El service
// lo traduce: nunca llega como tal al repositorio de InventoryEquipment.
export type InventoryListTipo = InventoryEquipmentType | 'pc';

export interface InventoryListFilters {
  empresaId?: string;
  tipo?: InventoryListTipo;
  // Puede ser un InventoryEquipmentStatus o un DeviceStatus según `tipo` —
  // ver InventoryService.list(), que solo lo aplica al lado que corresponde.
  estado?: string;
  search?: string;
}

// Fila normalizada para la lista/exportación combinada — un PC (con agente)
// y un equipo cargado a mano tienen formas completamente distintas, así que
// en vez de forzarlos a una interfaz común se discrimina por `origen` y se
// deja cada uno con su forma real anidada.
export type InventoryListItem =
  | { origen: 'manual'; equipment: import('@prisma/client').InventoryEquipment & { empresa?: { id: string; nombre: string } | null } }
  | { origen: 'agente'; device: Device & { empresa?: { id: string; nombre: string } | null } };
