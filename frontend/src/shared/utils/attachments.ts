import { apiClient } from '../api/client.ts';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

// El nombre en disco es "{uuid}__{original saneado}" para documentos (ver
// backend: quote-document-upload.middleware.ts, ticket-upload.middleware.ts,
// completion-upload.middleware.ts) — esto recupera el nombre real para
// mostrar, sin el prefijo random. Adjuntos viejos sin "__" (fotos generadas
// antes de este cambio, o firmas) devuelven el nombre tal cual.
export function attachmentDisplayName(url: string): string {
  const filename = url.split('/').pop() ?? url;
  return filename.includes('__') ? filename.split('__').slice(1).join('__') : filename;
}

function extensionOf(url: string): string {
  const name = attachmentDisplayName(url);
  return name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
}

// Decide si un adjunto se muestra como miniatura de imagen o como ícono de
// documento descargable — ver AttachmentThumbnail.tsx.
export function isImageAttachment(url: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(url));
}

// Genérico para cualquier adjunto autenticado (tickets, actividades,
// cotizaciones) — trae el archivo como blob (el link normal no manda el
// header Authorization) y dispara la descarga con el nombre real.
export async function downloadAttachment(url: string): Promise<void> {
  const { data } = await apiClient.get(url, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(data as Blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = attachmentDisplayName(url);
  link.click();
  URL.revokeObjectURL(blobUrl);
}
