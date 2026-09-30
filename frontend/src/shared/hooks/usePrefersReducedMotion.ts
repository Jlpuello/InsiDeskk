import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

// Usado por los carruseles/fondos animados de las páginas públicas
// (PublicGradientBackdrop, HomeLandingPage) para apagar el auto-avance sin
// tocar la navegación manual (dots, botones) — quien prefiere menos
// movimiento sigue pudiendo usar la página, solo no se mueve sola.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false));

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = () => setReduced(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return reduced;
}
