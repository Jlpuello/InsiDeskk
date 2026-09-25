import { getPrismaClient } from '../prisma/client.js';
import { getClientIP, getCurrentUserId, getUserAgent } from '../utils/context.js';
import { logger } from '../utils/logger.js';

// Acciones marcadas como críticas (cambio de rol, borrado de ticket/
// dispositivo, desactivar empresa) exigen un motivo explícito y quedan
// registradas con ese detalle — mismo nivel de trazabilidad que ya existe
// para aprobar/rechazar una cotización (actor, cuándo, por qué). Esto es
// ADICIONAL al auto-audit genérico que ya corre en
// shared/prisma/middleware/audit.middleware.ts para cualquier create/update/
// delete — esa fila nunca tiene motivo (no todo cambio es "crítico"), esta sí.
export type CriticalAction =
  | 'ROLE_CHANGE'
  | 'PERMISOS_CHANGE'
  | 'TICKET_DELETE'
  | 'DEVICE_DELETE'
  | 'COMPANY_DEACTIVATE'
  | 'USER_DELETE';

export async function recordCriticalAction(input: {
  accion: CriticalAction;
  tabla: string;
  registroId: string;
  motivo: string;
}): Promise<void> {
  try {
    await getPrismaClient().auditLog.create({
      data: {
        usuarioId: getCurrentUserId(),
        accion: input.accion,
        tabla: input.tabla,
        registroId: input.registroId,
        motivo: input.motivo,
        ipAddress: getClientIP(),
        userAgent: getUserAgent(),
        resultado: 'success',
      },
    });
  } catch (err) {
    // Best-effort: un fallo al auditar no debería tumbar la acción crítica en
    // sí (que ya ocurrió) — pero sí queda en el log del servidor para que no
    // pase desapercibido.
    logger.error(`No se pudo registrar la acción crítica "${input.accion}": ${(err as Error).message}`);
  }
}
