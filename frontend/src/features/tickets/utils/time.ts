// Formatea minutos acumulados (Ticket.tiempoReal) como "Xh Ym" para mostrar
// en la UI — 0 o null se muestra como "—" en vez de "0h 0m".
export function formatDuration(minutes?: number | null): string {
  if (!minutes || minutes <= 0) return '—';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
