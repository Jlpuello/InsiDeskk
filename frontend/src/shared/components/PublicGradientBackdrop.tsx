import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Headphones, ShieldCheck, Clock, Users } from 'lucide-react';

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
}

// Se posiciona con absolute inset-0 — el llamador es responsable de un
// contenedor `relative overflow-hidden` (y su propio contenido por encima,
// con z-10) exactamente como ya hacía SupportLandingPage.
export function PublicGradientBackdrop({ slides = DEFAULT_GRADIENT_SLIDES, overlay = true }: PublicGradientBackdropProps) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length]);

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
          <p className="absolute bottom-8 left-8 text-sm font-medium text-white/40">{caption}</p>
        </div>
      ))}
      {overlay && <div className="absolute inset-0 bg-black/40" />}
    </>
  );
}
