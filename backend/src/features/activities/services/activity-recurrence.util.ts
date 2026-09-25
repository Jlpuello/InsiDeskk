import type { RecurrenciaTipo } from '@prisma/client';

interface RecurrenceCheck {
  recurrenciaTipo: RecurrenciaTipo;
  recurrenciaDia: number | null;
  ultimaGeneracion: Date | null;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Pura y testeable a propósito — decide si HOY corresponde generar una nueva
// ocurrencia de esta plantilla. "Ya se generó hoy" corta cualquier caso antes
// de mirar el tipo de recurrencia (protege contra el cron corriendo dos
// veces el mismo día, o un reinicio del server).
export function shouldGenerateToday(plantilla: RecurrenceCheck, now: Date): boolean {
  if (plantilla.ultimaGeneracion && isSameDay(plantilla.ultimaGeneracion, now)) {
    return false;
  }

  switch (plantilla.recurrenciaTipo) {
    case 'diaria':
      return true;
    case 'semanal':
      return plantilla.recurrenciaDia === now.getDay();
    case 'mensual':
      return plantilla.recurrenciaDia === now.getDate();
    default:
      return false;
  }
}
