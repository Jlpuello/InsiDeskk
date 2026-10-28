// TicketStatus/TicketPriority reflejan los enums reales de Prisma
// (backend/prisma/schema.prisma) — ver ticket.repository.ts#countByStatus/
// countByPriority, que rellenan siempre las 6/4 claves con 0 si no hay datos.
export type TicketStatus = 'abierto' | 'en_progreso' | 'en_espera' | 'esperando_aprobacion' | 'cerrado' | 'cancelado';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'critica';
export type DeviceStatus = 'online' | 'offline' | 'inactivo';

export interface TicketStats {
  total: number;
  byEstado: Record<TicketStatus, number>;
}

export interface DeviceStats {
  total: number;
  byEstado: Record<DeviceStatus, number>;
}

export interface TicketTrendPoint {
  date: string;
  count: number;
}
