export interface QuoteLineItemInput {
  concepto: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeImpuesto?: number;
}

export interface CreateQuoteDTO {
  ticketId: string;
  empresaId: string;
  razon: string;
  creadoPorId: string;
  lineas: QuoteLineItemInput[];
}

export interface UpdateQuoteDTO {
  razon?: string;
  lineas?: QuoteLineItemInput[];
}

// Método de confirmación al aprobar — un solo valor hoy (firma dibujada +
// IP/timestamp/user-agent de respaldo), tipado como string para no atarse a
// un enum de Prisma por un único caso de uso.
export interface ApproveQuoteInput {
  firmaNombre: string;
  firmaImagenPath: string;
  ip: string;
  userAgent?: string;
  // Presente solo si el aprobador está autenticado (canal logueado del
  // híbrido) — ver QuoteService.approve.
  usuarioAutenticadoId?: string;
}

export interface RejectQuoteInput {
  nombre: string;
  motivo: string;
  ip: string;
  userAgent?: string;
  usuarioAutenticadoId?: string;
}
