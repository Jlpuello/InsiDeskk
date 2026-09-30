// 'esperando_aprobacion' lo fija solo el backend al enviar una cotización a
// aprobación (ver features/quotes) — pausa el SLA (slaPausadoEn) y bloquea el
// ticket hasta que se resuelva o se cancele la solicitud.
export type TicketStatus = 'abierto' | 'en_progreso' | 'en_espera' | 'esperando_aprobacion' | 'cerrado' | 'cancelado';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'critica';
export type TicketCriticidad = 'baja' | 'media' | 'alta' | 'critica';

export interface TicketCategory {
  id: string;
  nombre: string;
  activo: boolean;
  // Cuando están definidos, fijan ese valor para cualquier ticket de esta
  // categoría (el backend los impone al crear/editar el ticket) — ver
  // TicketCategoryService.resolveDefaults en el backend.
  prioridadDefault: TicketPriority | null;
  criticidadDefault: TicketCriticidad | null;
  // Nivel de técnico (1/2/3) que debe atender tickets de esta categoría — se
  // usa para auto-asignar al crear el ticket (ver TicketService.createTicket
  // en el backend). null = sin auto-asignación por nivel.
  nivelRequerido: number | null;
  subcategorias?: TicketSubcategory[];
}

export interface TicketSubcategory {
  id: string;
  categoriaId: string;
  nombre: string;
  activo: boolean;
  // Gana sobre el default de la categoría cuando ambos están definidos.
  prioridadDefault: TicketPriority | null;
  criticidadDefault: TicketCriticidad | null;
  nivelRequerido: number | null;
}

export interface SlaPolicy {
  id: string;
  prioridad: TicketPriority;
  criticidad: TicketCriticidad;
  tiempoRespuestaMin: number;
  tiempoResolucionMin: number;
  updatedAt: string;
}

// Fila ausente para una combinación (nivelTecnico, nivelTicket) = visible —
// ver ticket-level-visibility.service.ts en el backend.
export interface TicketLevelVisibility {
  id: string;
  nivelTecnico: number;
  nivelTicket: number;
  visible: boolean;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  titulo: string;
  descripcion?: string;
  estado: TicketStatus;
  prioridad: TicketPriority;
  criticidad: TicketCriticidad;
  categoriaId?: string | null;
  categoria?: TicketCategory | null;
  subcategoriaId?: string | null;
  subcategoria?: TicketSubcategory | null;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  // Nulo cuando el ticket viene del formulario público (sin cuenta) — ahí
  // reporterNombre/reporterEmail/reporterTelefono traen el contacto.
  usuarioReporterId?: string | null;
  usuarioReporter?: { id: string; nombre: string; email: string } | null;
  reporterNombre?: string | null;
  reporterEmail?: string | null;
  reporterTelefono?: string | null;
  // false solo en el flujo público cuando el contacto no coincide con
  // ninguno ya conocido de esta empresa — ver
  // shared/security/contact-verification.ts en el backend. Nunca bloqueó la
  // creación, es una señal para que el equipo revise antes de tratarlo como
  // un pedido legítimo de esa empresa.
  contactoVerificado?: boolean;
  usuarioAsignadoId?: string | null;
  usuarioAsignado?: { id: string; nombre: string; email: string } | null;
  resueltoId?: string | null;
  resuelto?: { id: string; nombre: string; email: string } | null;
  dispositivoId?: string;
  dispositivo?: { id: string; nombre: string } | null;
  slaRespuestaVence?: string | null;
  slaResolucionVence?: string | null;
  primeraRespuestaEn?: string | null;
  // No-nulo mientras estado==='esperando_aprobacion' — el SLA está pausado
  // desde este momento (ver features/quotes/QuoteSection).
  slaPausadoEn?: string | null;
  // Tiempo trabajado en minutos, acumulado a través de pausas/reanudaciones
  // (ver TicketService.changeTicketStatus en el backend). trabajoIniciadoEn
  // no-nulo significa que el cronómetro está corriendo ahora mismo.
  tiempoReal?: number | null;
  tiempoEstimado?: number | null;
  trabajoIniciadoEn?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreateTicketInput {
  titulo: string;
  descripcion?: string;
  empresaId: string;
  prioridad?: TicketPriority;
  criticidad?: TicketCriticidad;
  categoriaId?: string;
  subcategoriaId?: string;
  dispositivoId?: string;
  // Quién reportó de verdad (ej. alguien llamó y un admin/técnico registra el
  // ticket a su nombre) — informativo, el dueño del ticket sigue siendo la
  // cuenta autenticada que lo crea.
  reporterNombre?: string;
  reporterEmail?: string;
  reporterTelefono?: string;
}

export interface PublicTicketCategory {
  id: string;
  nombre: string;
  subcategorias: { id: string; nombre: string }[];
}

export interface CreatePublicTicketInput {
  // Uno de los dos, nunca ambos — sinNit es "soporte a un particular", sin
  // empresa de por medio (ver public-ticket.controller.ts).
  nit?: string;
  sinNit?: boolean;
  // Solo si el NIT no matcheó ninguna empresa registrada — ver
  // companyService.resolveOrProvisionByNit en el backend.
  nombreEmpresa?: string;
  // Se exige SIEMPRE, con o sin empresa ya registrada — el NIT no es
  // secreto, ver public-ticket.controller.ts. Ver shared/components/Turnstile.tsx.
  turnstileToken: string;
  titulo: string;
  descripcion?: string;
  categoriaId?: string;
  subcategoriaId?: string;
  reporterNombre: string;
  reporterEmail?: string;
  reporterTelefono?: string;
}

// 'cierre'/'reapertura' las crea solo el backend (ver
// TicketService.closeTicketWithResolution / reopenTicket) — no se ofrecen en
// el selector de tipo de nota del formulario normal.
export type NoteType = 'interna' | 'cliente' | 'sistema' | 'cierre' | 'reapertura';

export interface TicketNote {
  id: string;
  ticketId: string;
  usuarioId: string;
  contenido: string;
  tipo: NoteType;
  // Rutas relativas a GET /tickets/:id/attachments/:filename (requiere
  // Authorization — no son URLs públicas, ver AuthenticatedImage.tsx).
  adjuntos?: string[];
  createdAt: string;
  usuario?: { id: string; nombre: string; email: string };
}
