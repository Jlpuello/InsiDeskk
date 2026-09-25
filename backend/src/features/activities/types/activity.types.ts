import type { ActividadEstado, ActividadTipo, RecurrenciaTipo } from '@prisma/client';

export interface CreateActivityDTO {
  titulo: string;
  descripcion?: string;
  tipo?: ActividadTipo;
  empresaId: string;
  usuarioAsignadoId?: string;
  ticketId?: string;
  dispositivoId?: string;
  fechaPlaneada?: Date;
}

export interface UpdateActivityDTO {
  titulo?: string;
  descripcion?: string;
  tipo?: ActividadTipo;
  usuarioAsignadoId?: string | null;
  ticketId?: string | null;
  dispositivoId?: string | null;
  fechaPlaneada?: Date | null;
}

export interface ActivityFilters {
  empresaId?: string;
  estado?: ActividadEstado;
  tipo?: ActividadTipo;
  usuarioAsignadoId?: string;
}

export interface CreateActivityTemplateDTO {
  titulo: string;
  descripcion?: string;
  tipo?: ActividadTipo;
  empresaId: string;
  usuarioAsignadoId?: string;
  dispositivoId?: string;
  recurrenciaTipo: RecurrenciaTipo;
  recurrenciaDia?: number;
}

export interface UpdateActivityTemplateDTO {
  titulo?: string;
  descripcion?: string;
  usuarioAsignadoId?: string | null;
  dispositivoId?: string | null;
  recurrenciaTipo?: RecurrenciaTipo;
  recurrenciaDia?: number | null;
  activo?: boolean;
}
