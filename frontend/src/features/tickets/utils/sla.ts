export interface SlaBadgeInfo {
  label: string;
  className: string;
}

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60_000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(abs / 3_600_000);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

// Sirve para respuesta (completedAt = ticket.primeraRespuestaEn) y para
// resolución (completedAt = ticket.closedAt, solo si el estado es "cerrado" —
// un ticket "cancelado" no debería mostrar esto, eso lo decide quien llama).
export function getSlaBadge(
  dueAt: string | null | undefined,
  completedAt: string | null | undefined,
): SlaBadgeInfo | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();

  if (completedAt) {
    const completed = new Date(completedAt).getTime();
    return completed <= due
      ? { label: 'Cumplido', className: 'bg-green-100 text-green-800' }
      : { label: `Incumplido (+${formatDuration(completed - due)})`, className: 'bg-red-100 text-red-800' };
  }

  const diff = due - Date.now();
  if (diff < 0) return { label: `Vencido hace ${formatDuration(diff)}`, className: 'bg-red-100 text-red-800' };

  const urgent = diff < 2 * 3_600_000;
  return {
    label: `Vence en ${formatDuration(diff)}`,
    className: urgent ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600',
  };
}
