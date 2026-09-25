export type ActivityType = 'integracion' | 'mantenimiento' | 'seguimiento' | 'otro';
export type ActivityStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
export type RecurrenceType = 'diaria' | 'semanal' | 'mensual';

export interface Activity {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: ActivityType;
  estado: ActivityStatus;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  usuarioAsignadoId?: string | null;
  usuarioAsignado?: { id: string; nombre: string; email: string } | null;
  ticketId?: string | null;
  ticket?: { id: string; titulo: string } | null;
  dispositivoId?: string | null;
  dispositivo?: { id: string; nombre: string } | null;
  plantillaId?: string | null;
  plantilla?: { id: string; titulo: string } | null;
  fechaPlaneada?: string | null;
  fechaCompletada?: string | null;
  // Qué se hizo — obligatorio para completar (ver CompleteActivityModal),
  // distinto del acta de entrega: el acta reusa este texto en vez de volver
  // a pedirlo.
  resultado?: string | null;
  // Fotos de evidencia del cierre (hasta 5) — rutas relativas a
  // GET /activities/:id/resultado/attachments/:filename, requieren
  // Authorization (ver AuthenticatedImage.tsx), no son URLs públicas.
  resultadoAdjuntos?: string[];
  createdAt: string;
  updatedAt: string;
  seguimientos?: ActivityFollowup[];
  acta?: Acta | null;
}

export interface ActivityFollowup {
  id: string;
  actividadId: string;
  usuarioId: string;
  contenido: string;
  createdAt: string;
  usuario?: { id: string; nombre: string; email: string };
}

export interface Acta {
  id: string;
  actividadId: string;
  contenido: string;
  firmaNombre: string;
  // Ruta relativa a GET /activities/:id/acta/signature/:filename — requiere
  // Authorization, no es una URL pública (ver AuthenticatedImage.tsx).
  firmaImagen: string;
  firmadoEn: string;
  pdfPath?: string | null;
  enviadoA?: string | null;
  enviadoEn?: string | null;
  creadoPorId: string;
  createdAt: string;
}

export interface ActivityTemplate {
  id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: ActivityType;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  usuarioAsignadoId?: string | null;
  usuarioAsignado?: { id: string; nombre: string; email: string } | null;
  dispositivoId?: string | null;
  dispositivo?: { id: string; nombre: string } | null;
  recurrenciaTipo: RecurrenceType;
  recurrenciaDia?: number | null;
  activo: boolean;
  ultimaGeneracion?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActivityInput {
  titulo: string;
  descripcion?: string;
  tipo?: ActivityType;
  empresaId: string;
  usuarioAsignadoId?: string;
  ticketId?: string;
  dispositivoId?: string;
  fechaPlaneada?: string;
}

export interface UpdateActivityInput {
  titulo?: string;
  descripcion?: string | null;
  tipo?: ActivityType;
  usuarioAsignadoId?: string | null;
  ticketId?: string | null;
  dispositivoId?: string | null;
  fechaPlaneada?: string | null;
}

export interface CreateActivityTemplateInput {
  titulo: string;
  descripcion?: string;
  tipo?: ActivityType;
  empresaId: string;
  usuarioAsignadoId?: string;
  dispositivoId?: string;
  recurrenciaTipo: RecurrenceType;
  recurrenciaDia?: number;
}

export interface UpdateActivityTemplateInput {
  titulo?: string;
  descripcion?: string | null;
  usuarioAsignadoId?: string | null;
  dispositivoId?: string | null;
  recurrenciaTipo?: RecurrenceType;
  recurrenciaDia?: number | null;
  activo?: boolean;
}
