import request from 'supertest';
import type { Company, User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { jwtService } from '../../../shared/auth/jwt.service.js';
import { activityService } from '../services/activity.service.js';
import { runWithContext } from '../../../shared/utils/context.js';
import { createTestCompany, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Reproduce el pedido: "pausar" una actividad (en_progreso → pendiente, antes
// no existía ningún botón para esto) debe exigir motivo.
describe('motivo obligatorio al pausar una actividad', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  let company: Company;
  let tecnico: User;
  let activityId: string;

  const bearer = (u: User) => ({ Authorization: `Bearer ${jwtService.generateTokens(u).accessToken}` });

  beforeAll(async () => {
    company = await createTestCompany();
    tecnico = await createTestUser('tecnico', company.id);
  });

  beforeEach(async () => {
    const activity = await runWithContext({ userId: tecnico.id, userRole: 'tecnico', empresaId: company.id }, () =>
      activityService.create({ titulo: 'Actividad para pausar', empresaId: company.id, usuarioAsignadoId: tecnico.id }),
    );
    await runWithContext({ userId: tecnico.id, userRole: 'tecnico', empresaId: company.id }, () =>
      activityService.changeStatus(activity.id, 'en_progreso'),
    );
    activityId = activity.id;
  });

  afterAll(async () => {
    await prisma.actividadSeguimiento.deleteMany({ where: { actividad: { empresaId: company.id } } });
    await prisma.notification.deleteMany({ where: { usuarioId: tecnico.id } });
    await prisma.actividad.deleteMany({ where: { empresaId: company.id } });
    await deleteTestUsers(tecnico);
    await prisma.company.delete({ where: { id: company.id } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('sin motivo, 422', async () => {
    const res = await request(app).patch(`/api/activities/${activityId}/estado`).set(bearer(tecnico)).send({ estado: 'pendiente' });
    expect(res.status).toBe(422);
  });

  it('con motivo, pausa y lo deja registrado como seguimiento', async () => {
    const res = await request(app)
      .patch(`/api/activities/${activityId}/estado`)
      .set(bearer(tecnico))
      .send({ estado: 'pendiente', motivo: 'Cliente pidió reprogramar la visita' });

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('pendiente');

    const seguimientos = await prisma.actividadSeguimiento.findMany({ where: { actividadId: activityId } });
    expect(seguimientos.some((s) => s.contenido.includes('Cliente pidió reprogramar la visita'))).toBe(true);
  });

  it('no se puede pausar una actividad que nunca se inició (sigue pendiente)', async () => {
    const fresh = await runWithContext({ userId: tecnico.id, userRole: 'tecnico', empresaId: company.id }, () =>
      activityService.create({ titulo: 'Actividad nunca iniciada', empresaId: company.id, usuarioAsignadoId: tecnico.id }),
    );

    const res = await request(app)
      .patch(`/api/activities/${fresh.id}/estado`)
      .set(bearer(tecnico))
      .send({ estado: 'pendiente', motivo: 'Motivo válido de sobra' });
    expect(res.status).toBe(422);
  });
});
