import { useEffect } from 'react';
import { AuthenticatedImage } from './AuthenticatedImage.tsx';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

// Overlay a pantalla completa para ver una evidencia (foto de cierre de
// ticket, de actividad, etc.) en tamaño grande. Reemplaza el viejo patrón de
// <a target="_blank"> hacia el endpoint autenticado, que fallaba con 401
// porque la navegación de un link no manda el header Authorization.
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 rounded-md p-2 text-2xl leading-none text-white/80 hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
      <AuthenticatedImage
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
      />
    </div>
  );
}
