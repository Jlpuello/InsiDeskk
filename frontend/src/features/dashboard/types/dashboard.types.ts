export type TicketStatus = 'abierto' | 'en_progreso' | 'en_espera' | 'cerrado' | 'cancelado';
export type DeviceStatus = 'online' | 'offline' | 'inactivo';

export interface TicketStats {
  total: number;
  byEstado: Record<TicketStatus, number>;
}

export interface DeviceStats {
  total: number;
  byEstado: Record<DeviceStatus, number>;
}
