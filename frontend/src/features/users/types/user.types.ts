export type UserRole = 'admin' | 'tecnico' | 'cliente';

export interface UserSummary {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  empresaId?: string;
  empresaNombre?: string;
  // Solo tiene sentido para rol='tecnico' — nivel 1/2/3 usado para la
  // auto-asignación por categoría (ver TicketCategory.nivelRequerido en el backend).
  nivel: number | null;
  // Capacidades puntuales además del rol (reemplaza al viejo esAprobador
  // booleano) — hoy el único valor real es "quotes:approve", ver
  // Configuración → Aprobadores.
  permisos: string[];
}
