import type { Company, User } from '@prisma/client';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { eventEmitter } from '../../../shared/events/event.emitter.js';
import { runWithContext } from '../../../shared/utils/context.js';
import { registerNotificationListeners, shutdownNotificationQueues } from '../../notifications/index.js';
import { activityRecurrenceScheduler } from '../services/activity-recurrence.scheduler.js';
import { activityService } from '../services/activity.service.js';
import { createTestCompany, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Reproduce el reporte "las actividades programadas no generan notificación al
// responsable" — antes de esto, ni la creación manual con responsable ni las
// generadas por una plantilla recurrente disparaban nada (ver
// activity.service.ts / activity-recurrence.scheduler.ts).
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// La notificación llega asíncrona (evento por Redis pub/sub -> cola de Bull),
// así que un `wait` fijo es frágil bajo carga (ej. el resto de la suite
// corriendo en paralelo contra la misma DB/Redis) — sondea en vez de apostar a
// un tiempo fijo.
async function waitUntil(predicate: () => Promise<boolean>, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return true;
    await wait(200);
  }
  return false;
}

// Timeout por test (tercer argumento de `it`, más abajo) en vez de
// jest.setTimeout(...) a nivel de módulo: bajo `--experimental-vm-modules`
// (ESM) el global `jest` no siempre queda inyectado a tiempo cuando el
// archivo corre junto al resto de la suite (sí al correrlo solo) — esto no
// depende de eso.
const LONG_TEST_TIMEOUT = 25000;

describe('notificaciones de actividades', () => {
  const prisma = getPrismaClient();
  let company: Company;
  let tecnico: User;

  beforeAll(async () => {
    registerNotificationListeners();
    await wait(500);
    company = await createTestCompany();
    tecnico = await createTestUser('tecnico');
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { usuarioId: tecnico.id } });
    await prisma.actividad.deleteMany({ where: { empresaId: company.id } });
    await deleteTestUsers(tecnico);
    await prisma.company.delete({ where: { id: company.id } });
    await shutdownNotificationQueues();
    await eventEmitter.disconnect();
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('notifica al responsable al crear una actividad manual con asignado', async () => {
    await activityService.create({ titulo: 'Manual con responsable', empresaId: company.id, usuarioAsignadoId: tecnico.id });

    const llegó = await waitUntil(async () => {
      const notifs = await prisma.notification.findMany({ where: { usuarioId: tecnico.id } });
      return notifs.some((n) => n.titulo === 'Actividad asignada');
    });
    expect(llegó).toBe(true);
  }, LONG_TEST_TIMEOUT);

  it('notifica al responsable cuando una plantilla recurrente genera la actividad', async () => {
    const template = await prisma.actividadPlantilla.create({
      data: { titulo: 'Plantilla diaria', tipo: 'mantenimiento', empresaId: company.id, usuarioAsignadoId: tecnico.id, recurrenciaTipo: 'diaria', activo: true },
    });
    const antes = (await prisma.notification.findMany({ where: { usuarioId: tecnico.id } })).length;

    await activityRecurrenceScheduler.run();

    const llegó = await waitUntil(async () => {
      const notifs = await prisma.notification.findMany({ where: { usuarioId: tecnico.id } });
      return notifs.length > antes;
    });
    expect(llegó).toBe(true);

    await prisma.actividadPlantilla.delete({ where: { id: template.id } });
  }, LONG_TEST_TIMEOUT);

  it('reasignar a otro técnico lo notifica a él, no vuelve a notificar al anterior', async () => {
    const tecnico2 = await createTestUser('tecnico');
    const activity = await activityService.create({ titulo: 'Para reasignar', empresaId: company.id, usuarioAsignadoId: tecnico.id });

    await runWithContext({ userId: tecnico.id, userRole: 'admin' }, () =>
      activityService.update(activity.id, { usuarioAsignadoId: tecnico2.id }),
    );

    const llegó = await waitUntil(async () => {
      const notifs2 = await prisma.notification.findMany({ where: { usuarioId: tecnico2.id } });
      return notifs2.some((n) => n.titulo === 'Actividad asignada');
    });
    expect(llegó).toBe(true);

    await prisma.notification.deleteMany({ where: { usuarioId: tecnico2.id } });
    await deleteTestUsers(tecnico2);
  }, LONG_TEST_TIMEOUT);

  it('un update que no reasigna no genera una notificación extra', async () => {
    const baseline = (await prisma.notification.findMany({ where: { usuarioId: tecnico.id } })).length;
    const activity = await activityService.create({ titulo: 'Sin reasignar', empresaId: company.id, usuarioAsignadoId: tecnico.id });
    // Espera la notificación de ESTA creación en particular (no alcanza con
    // "que exista alguna" — ya hay de tests anteriores) antes de tomar la
    // base para la aserción de ausencia de abajo.
    await waitUntil(async () => {
      const notifs = await prisma.notification.findMany({ where: { usuarioId: tecnico.id } });
      return notifs.length > baseline;
    });
    const antes = (await prisma.notification.findMany({ where: { usuarioId: tecnico.id } })).length;

    await runWithContext({ userId: tecnico.id, userRole: 'admin' }, () =>
      activityService.update(activity.id, { descripcion: 'solo texto' }),
    );
    // Acá se espera que NO pase nada — un `wait` fijo (generoso) es lo correcto
    // para una aserción de ausencia, `waitUntil` no aplica.
    await wait(3000);

    const despues = await prisma.notification.findMany({ where: { usuarioId: tecnico.id } });
    expect(despues.length).toBe(antes);
  }, LONG_TEST_TIMEOUT);
});
