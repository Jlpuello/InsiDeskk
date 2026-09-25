// "31 mar" para fechas viejas, hora ("14:32") si el mensaje es de hoy —
// mismo criterio que usa la lista de conversaciones.
export function formatListDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toLowerCase().replace('.', '');
}

// "06:30" dentro de una burbuja de mensaje.
export function formatBubbleTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
