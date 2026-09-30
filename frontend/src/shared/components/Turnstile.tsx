import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

// Carga el script de Cloudflare Turnstile una sola vez por página, sin
// importar cuántos <Turnstile> se monten. No pasa por el CSP del backend
// (helmet en app.ts solo aplica a las respuestas de la API) — esto corre en
// el HTML que sirve Vite, sin restricción propia.
function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Turnstile'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
}

// Widget de verificación anti-bot — se exige en TODOS los caminos públicos
// de tickets/chat (con o sin NIT ya registrado, ver public-ticket.controller.ts
// y conversation-public.controller.ts: el NIT no es secreto, así que por sí
// solo no prueba identidad). Sin site key configurada, muestra un aviso en
// vez de un widget roto.
export function Turnstile({ onVerify }: TurnstileProps) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        window.turnstile.render(containerRef.current, { sitekey: siteKey, callback: onVerify });
      })
      .catch(() => setFailed(true));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey || failed) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Verificación de seguridad no disponible en este momento — intentá de nuevo más tarde.
      </p>
    );
  }

  return <div ref={containerRef} />;
}
