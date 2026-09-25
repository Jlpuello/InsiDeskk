import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, ShieldCheck, Clock, Users, MessageCircle } from 'lucide-react';
import { FloatingSupportWidget } from './FloatingSupportWidget.tsx';

// Sin fotos reales (no hay assets de "soporte técnico" disponibles y no vale
// la pena depender de una URL de imágenes externa que puede romperse o no
// encajar con la marca) — el "slider de fondo" son paneles de gradiente +
// ícono + frase, con el mismo efecto visual de una landing profesional sin
// ninguna dependencia nueva.
const SLIDES = [
  { gradient: 'from-blue-950 via-blue-900 to-blue-700', Icon: Headphones, caption: 'Soporte remoto en minutos' },
  { gradient: 'from-slate-950 via-slate-900 to-blue-800', Icon: ShieldCheck, caption: 'Equipo certificado' },
  { gradient: 'from-indigo-950 via-indigo-900 to-blue-800', Icon: Clock, caption: 'Disponibilidad 24/7' },
  { gradient: 'from-blue-950 via-slate-900 to-slate-800', Icon: Users, caption: 'Atención personalizada' },
] as const;

const SLIDE_INTERVAL_MS = 5000;

// Punto de entrada único a soporte para empresas con o sin contrato/registro
// (ver companyService.resolveOrProvisionByNit) — un solo CTA central que
// abre el widget flotante (bot + chat en vivo fusionados, ver
// FloatingSupportWidget.tsx). /reportar y /chat siguen funcionando solos
// para quien tenga el link directo.
export function SupportLandingPage() {
  const [slide, setSlide] = useState(0);
  const [widgetOpen, setWidgetOpen] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      {SLIDES.map(({ gradient, Icon, caption }, i) => (
        <div
          key={i}
          className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-opacity duration-1000 ${
            i === slide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Icon className="absolute -right-16 -top-16 h-96 w-96 text-white/5" strokeWidth={1} />
          <p className="absolute bottom-8 left-8 text-sm font-medium text-white/40">{caption}</p>
        </div>
      ))}
      <div className="absolute inset-0 bg-black/40" />

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
