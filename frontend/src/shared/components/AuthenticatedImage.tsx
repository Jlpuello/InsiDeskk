import { useEffect, useState } from 'react';
import { apiClient } from '../api/client.ts';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

// Para cualquier imagen servida por un endpoint autenticado (adjuntos de
// cierre de ticket, firmas de actas, etc.) — un <img src="..."> normal no
// manda el header Authorization, así que se trae como blob por axios (que sí
// lo manda) y se arma una URL local para el <img>.
export function AuthenticatedImage({ src, alt, className, onClick }: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    apiClient
      .get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(res.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!blobUrl) {
    return <div className={className} />;
  }

  return <img src={blobUrl} alt={alt} className={className} onClick={onClick} />;
}
