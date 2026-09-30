import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Headphones, ShieldCheck, Clock, Users } from 'lucide-react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion.ts';

export interface GradientSlide {
  gradient: string;
  Icon: LucideIcon;
  caption: string;
}

// Antes vivía solo dentro de SupportLandingPage — se comparte acá para que
// el login y la home pública tengan el mismo fondo de marca (pedido
// explícito: "me gusta el fondo que colocaste en soporte"), en vez de cada
// página inventando el suyo. Sin fotos reales a propósito (ver comentario
// original en SupportLandingPage): paneles de gradiente + ícono + frase dan
// el mismo efecto de landing profesional sin depender de assets externos.
export const DEFAULT_GRADIENT_SLIDES: readonly GradientSlide[] = [
  { gradient: 'from-blue-950 via-blue-900 to-blue-700', Icon: Headphones, caption: 'Soporte remoto en minutos' },
  { gradient: 'from-slate-950 via-slate-900 to-blue-800', Icon: ShieldCheck, caption: 'Equipo certificado' },
  { gradient: 'from-indigo-950 via-indigo-900 to-blue-800', Icon: Clock, caption: 'Disponibilidad 24/7' },
  { gradient: 'from-blue-950 via-slate-900 to-slate-800', Icon: Users, caption: 'Atención personalizada' },
] as const;

const SLIDE_INTERVAL_MS = 5000;

interface PublicGradientBackdropProps {
  slides?: readonly GradientSlide[];
  overlay?: boolean;
  // El llamador lo pone en true cuando este fondo no está realmente a la
  // vista (ej. HomeLandingPage, donde el fondo vive solo en la sección 1 del
  // carrusel) — evita que siga rotando "por atrás" sin que nadie lo vea.
  paused?: boolean;
}

// Se posiciona con absolute inset-0 — el llamador es responsable de un
// contenedor `relative overflow-hidden` (y su propio contenido por encima,
// con z-10) exactamente como ya hacía SupportLandingPage.
export function PublicGradientBackdrop({ slides = DEFAULT_GRADIENT_SLIDES, overlay = true, paused = false }: PublicGradientBackdropProps) {
  const [slide, setSlide] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (paused || reducedMotion) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length, paused, reducedMotion]);

  return (
    <>
      {slides.map(({ gradient, Icon, caption }, i) => (
        <div
          key={i}
          className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-opacity duration-1000 ${
            i === slide ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Icon className="absolute -right-16 -top-16 h-96 w-96 text-white/5" strokeWidth={1} />
          {/* Oculta en mobile: a ese ancho choca con los puntos de navegación
              del carrusel que la usa (ver HomeLandingPage) — es flavor text
              decorativo, no info que valga la pena pelear por el espacio. */}
          <p className="absolute bottom-8 left-8 hidden text-sm font-medium text-white/40 sm:block">{caption}</p>
        </div>
      ))}
      {overlay && <div className="absolute inset-0 bg-black/40" />}
    </>
  );
}
