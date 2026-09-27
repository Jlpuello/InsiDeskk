import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { PublicGradientBackdrop } from '../../../shared/components/PublicGradientBackdrop.tsx';
import { FloatingSupportWidget } from './FloatingSupportWidget.tsx';

// Punto de entrada único a soporte para empresas con o sin contrato/registro
// (ver companyService.resolveOrProvisionByNit) — un solo CTA central que
// abre el widget flotante (bot + chat en vivo fusionados, ver
// FloatingSupportWidget.tsx). /reportar y /chat siguen funcionando solos
// para quien tenga el link directo.
export function SupportLandingPage() {
  const [widgetOpen, setWidgetOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      <PublicGradientBackdrop />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-300">Soporte técnico</p>
        <h1 className="mb-4 max-w-xl text-3xl font-semibold text-white sm:text-4xl">
          ¿Necesitás ayuda con tu equipo o tu red?
        </h1>
        <p className="mb-8 max-w-md text-sm text-slate-200 sm:text-base">
          Con o sin contrato vigente — nuestro equipo te responde al instante.
        </p>

        <button
          onClick={() => setWidgetOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-blue-800 shadow-lg transition-transform hover:scale-[1.02] hover:bg-blue-50 sm:text-base"
        >
          <MessageCircle size={18} />
          Pedir soporte
        </button>

        <Link to="/reportar" className="mt-5 text-xs text-blue-100 underline decoration-blue-300/50 hover:text-white sm:text-sm">
          ¿Preferís completar un formulario? Reportar directamente
        </Link>
      </div>

      <FloatingSupportWidget open={widgetOpen} onOpenChange={setWidgetOpen} />
    </div>
  );
}
