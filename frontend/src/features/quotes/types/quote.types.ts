export type QuoteEstado = 'borrador' | 'pendiente_aprobacion' | 'aprobado' | 'rechazado' | 'expirado';

export interface QuoteLineItem {
  id: string;
  concepto: string;
  // Vienen como string desde el backend (Prisma.Decimal se serializa como
  // string en JSON) — se parsean a número solo para mostrar/calcular en UI.
  cantidad: string;
  valorUnitario: string;
  porcentajeImpuesto: string;
  subtotal: string;
}

export interface Quote {
  id: string;
  ticketId: string;
  ticket?: { id: string; titulo: string; estado: string } | null;
  empresaId: string;
  empresa?: { id: string; nombre: string } | null;
  razon: string;
  estado: QuoteEstado;
  subtotal: string;
  impuestos: string;
  total: string;
  creadoPorId: string;
  creadoPor?: { id: string; nombre: string; email: string } | null;
  contactoAutorizadorId: string | null;
  contactoAutorizador?: { id: string; nombre: string; email: string } | null;
  ticketEstadoPrevio: string | null;
  tokenExpiresAt?: string | null;
  resueltoNombre?: string | null;
  resueltoIp?: string | null;
  resueltoUserAgent?: string | null;
  resueltoEn?: string | null;
  firmaImagen?: string | null;
  motivoRechazo?: string | null;
  pdfPath?: string | null;
  // Rutas relativas servidas por /quotes/:id/documents/:filename — el nombre
  // real (para mostrar/descargar) va después del "__" en el filename, ver
  // quote.api.ts#documentDisplayName.
  documentos: string[];
  lineas: QuoteLineItem[];
  createdAt: string;
  updatedAt: string;
}

export interface QuoteLineItemInput {
  concepto: string;
  cantidad: number;
  valorUnitario: number;
  porcentajeImpuesto?: number;
}

export interface CreateQuoteInput {
  ticketId: string;
  empresaId: string;
  razon: string;
  lineas: QuoteLineItemInput[];
}

export interface UpdateQuoteInput {
  razon?: string;
  lineas?: QuoteLineItemInput[];
}

export interface QuoteApprover {
  id: string;
  nombre: string;
  email: string;
}
