export interface AuditLogEntry {
  id: string;
  usuarioId?: string | null;
  usuario?: { id: string; nombre: string; email: string } | null;
  accion: string;
  tabla: string;
  registroId?: string | null;
  cambiosAnteriores?: Record<string, unknown> | null;
  cambiosNuevos?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  resultado: 'success' | 'failure';
  errorMessage?: string | null;
  motivo?: string | null;
  createdAt: string;
}

export interface FailedLoginEntry {
  id: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  razon: string;
  createdAt: string;
}
