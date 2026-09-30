import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import type { ReactNode } from 'react';

// Layout compartido por Términos y Privacidad — a diferencia de las
// secciones de la home (slides a pantalla completa, fondo oscuro), esto es
// texto denso para leer: página normal, con scroll, ancho de lectura acotado
// (max-w-2xl). El wash (from-blue-50 to-white) + las dos manchas arriba dan
// el mismo toque de marca que el resto de las páginas públicas sin pelear
// con la lectura — se apaga a blanco antes de llegar al cuerpo del texto, a
// diferencia de SoftGradientBackdrop (pensado para una sola pantalla, no
// para una página que puede scrollear mucho más abajo).
export function LegalPageLayout({ title, updatedLabel, children }: { title: string; updatedLabel: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-blue-200 opacity-40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -top-16 h-80 w-80 rounded-full bg-indigo-100 opacity-40 blur-3xl" />

      <div className="relative border-b border-gray-100 px-4 py-4">
        <Link to="/" className="mx-auto flex max-w-2xl items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Ticket size={16} />
          </span>
          <span className="text-sm font-semibold text-gray-900">InsiDesk</span>
        </Link>
      </div>

      <div className="relative mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-1 text-2xl font-semibold text-gray-900">{title}</h1>
        <p className="mb-8 text-xs text-gray-400">{updatedLabel}</p>
        <div className="space-y-6 text-sm leading-relaxed text-gray-600 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-gray-900 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </div>
  );
}
