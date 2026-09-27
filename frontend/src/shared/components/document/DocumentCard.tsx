import type { ReactNode } from 'react';
import clsx from 'clsx';

// Anatomía de "documento formal" compartida entre el cierre de un ticket, el
// acta de entrega, y los informes imprimibles (Ticket/Device/InventoryReport)
// — misma tarjeta que del lado del backend dibuja shared/pdf/document-pdf.ts,
// para que cerrar un caso se sienta como un solo sistema de la app al PDF.

export type DocumentStatusTone = 'good' | 'warn' | 'neutral';

export interface DocumentStatus {
  label: string;
  tone: DocumentStatusTone;
}

export interface DocumentField {
  label: string;
  value: ReactNode;
}

const STATUS_STYLES: Record<DocumentStatusTone, string> = {
  good: 'bg-green-50 text-green-700 border-green-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  neutral: 'bg-gray-100 text-gray-600 border-gray-200',
};

interface DocumentCardProps {
  eyebrow: string;
  title: string;
  reference?: string;
  status?: DocumentStatus;
  fields?: DocumentField[];
  footerLeft?: string;
  footerRight?: string;
  children?: ReactNode;
  className?: string;
}

interface DocumentHeaderProps {
  eyebrow: string;
  title: string;
  reference?: string;
  status?: DocumentStatus;
  className?: string;
}

// La franja oscura por sí sola — para pantallas que necesitan su propia
// grilla de metadatos más grande que las 4 columnas de DocumentCard (ver
// TicketReport.tsx, con ~16 campos: SLA, prioridad, criticidad, etc.).
export function DocumentHeader({ eyebrow, title, reference, status, className }: DocumentHeaderProps) {
  return (
    <div className={clsx('bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5 text-white', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">{eyebrow}</p>
          <h3 className="mt-1 truncate font-document text-xl font-semibold text-white">{title}</h3>
        </div>
        {status && (
          <span
            className={clsx(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
              STATUS_STYLES[status.tone],
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {status.label}
          </span>
        )}
      </div>
      {reference && <p className="mt-2 text-right font-mono text-[11px] text-slate-400">{reference}</p>}
    </div>
  );
}

export function DocumentCard({ eyebrow, title, reference, status, fields, footerLeft, footerRight, children, className }: DocumentCardProps) {
  return (
    <div className={clsx('overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm', className)}>
      <DocumentHeader eyebrow={eyebrow} title={title} reference={reference} status={status} />

      {fields && fields.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-gray-100 px-6 py-4 sm:grid-cols-4">
          {fields.map((f, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">{f.label}</dt>
              <dd className="mt-0.5 truncate text-sm font-medium text-gray-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-col gap-4 px-6 py-5">{children}</div>

      {(footerLeft || footerRight) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-400">
          <span>{footerLeft}</span>
          <span className="font-mono">{footerRight}</span>
        </div>
      )}
    </div>
  );
}

// Bloque destacado con riel de color — para el contenido que realmente
// importa (resolución, trabajo realizado, razón técnica), antes indistinguible
// del resto del texto plano.
export function DocumentSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-[3px] shrink-0 rounded-full bg-blue-600" />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700">{label}</p>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{children}</div>
      </div>
    </div>
  );
}

// Caja tipo "acta" para firma/sign-off — antes una imagen suelta con el
// nombre al lado, ahora se lee como un documento firmado.
export function DocumentSignature({
  children,
  name,
  role,
  date,
  action,
}: {
  children: ReactNode; // la imagen de la firma (AuthenticatedImage/img)
  name: string;
  role: string;
  date: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
      <div className="shrink-0">{children}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{name}</p>
        <p className="text-xs text-gray-500">{role}</p>
        <p className="font-mono text-[11px] text-gray-400">{date}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Etiqueta pequeña reusada arriba de una grilla de evidencia
// (AttachmentThumbnail) — solo tipografía, sin marcar nada más.
export function DocumentLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{children}</p>;
}
