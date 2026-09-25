import type { Device } from '../../devices/types/device.types.ts';

export type InventoryEquipmentType =
  | 'router'
  | 'switch'
  | 'access_point'
  | 'impresora'
  | 'dvr'
  | 'camara_ip'
  | 'control_acceso';

export type InventoryEquipmentStatus = 'activo' | 'en_reparacion' | 'dado_de_baja';

export interface InventoryEquipment {
  id: string;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  tipo: InventoryEquipmentType;
  nombre: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  ipAddress?: string | null;
  macAddress?: string | null;
  ubicacion?: string | null;
  proveedor?: string | null;
  fechaCompra?: string | null;
  garantiaVence?: string | null;
  estado: InventoryEquipmentStatus;
  // Cifradas en reposo (ver backend) pero visibles acá sin enmascarar — esta
  // es una herramienta interna, solo admin/técnico llegan a esta pantalla
  // (mismo criterio que Device, ver shared/utils/mask.ts en el backend).
  // Nunca deben usarse para armar las columnas de una exportación.
  credencialUsuario?: string | null;
  credencialPassword?: string | null;
  notasConfiguracion?: string | null;
  notas?: string | null;
  atributos?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryEquipmentInput {
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
  fechaCompra?: string;
  garantiaVence?: string;
  estado?: InventoryEquipmentStatus;
  credencialUsuario?: string;
  credencialPassword?: string;
  notasConfiguracion?: string;
  notas?: string;
  atributos?: Record<string, unknown>;
}

// 'pc' es un pseudo-tipo (no existe en el backend como InventoryEquipmentType)
// — pide "solo los equipos con agente" en la lista/exportación combinada.
export type InventoryListTipo = InventoryEquipmentType | 'pc';

export interface InventoryFilters {
  empresaId?: string;
  tipo?: InventoryListTipo;
  // Puede ser un InventoryEquipmentStatus o un DeviceStatus según `tipo` —
  // el selector de estado en la UI ofrece uno u otro vocabulario según el
  // tipo elegido (ver InventoryList).
  estado?: string;
  search?: string;
}

// Fila normalizada para la lista combinada — un PC (con agente) y un equipo
// cargado a mano tienen formas completamente distintas, así que se
// discrimina por `origen` en vez de forzarlos a una interfaz común.
export type InventoryListItem =
  | { origen: 'manual'; equipment: InventoryEquipment }
  | { origen: 'agente'; device: Device };
