import clsx from 'clsx';
import { FileText } from 'lucide-react';
import { AuthenticatedImage } from './AuthenticatedImage.tsx';
import { attachmentDisplayName, downloadAttachment, isImageAttachment } from '../utils/attachments.ts';

interface AttachmentThumbnailProps {
  url: string;
  alt: string;
  className?: string;
  // Solo se usa para imágenes (abre el lightbox) — un documento se descarga
  // directo al hacer click, no tiene "vista ampliada".
  onImageClick?: () => void;
}

// Reemplaza un <AuthenticatedImage> a secas donde antes se asumía que todo
// adjunto era una foto (cierre de ticket, completar actividad) — ahora
// también pueden ser PDF/Word/Excel (ver ticket-upload.middleware.ts /
// completion-upload.middleware.ts), que no tiene sentido intentar mostrar
// como <img>.
export function AttachmentThumbnail({ url, alt, className, onImageClick }: AttachmentThumbnailProps) {
  if (isImageAttachment(url)) {
    return (
      <button type="button" onClick={onImageClick} className="shrink-0">
        <AuthenticatedImage src={url} alt={alt} className={className} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void downloadAttachment(url)}
      title={attachmentDisplayName(url)}
      className={clsx('flex shrink-0 flex-col items-center justify-center gap-1 bg-gray-50 p-1', className)}
    >
      <FileText size={20} className="shrink-0 text-gray-400" />
      <span className="w-full truncate px-1 text-center text-[9px] text-gray-500">{attachmentDisplayName(url)}</span>
    </button>
  );
}
