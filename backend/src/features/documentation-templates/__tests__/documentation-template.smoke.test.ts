import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { jwtService } from '../../../shared/auth/jwt.service.js';
import { createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

describe('plantillas de documentación', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  let admin: User;
  let tecnico: User;
  let templateId: string;

  const bearer = (u: User) => ({ Authorization: `Bearer ${jwtService.generateTokens(u).accessToken}` });

  beforeAll(async () => {
    admin = await createTestUser('admin');
    tecnico = await createTestUser('tecnico');
  });

  afterAll(async () => {
    if (templateId) await prisma.documentationTemplate.delete({ where: { id: templateId } }).catch(() => {});
    await deleteTestUsers(admin, tecnico);
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('un técnico no puede crear una plantilla (403)', async () => {
    const res = await request(app)
      .post('/api/documentation-templates')
      .set(bearer(tecnico))
      .send({ titulo: 'x', contenido: 'y', contextos: ['cierre_ticket'] });
    expect(res.status).toBe(403);
  });

  it('un admin sí puede crear una plantilla', async () => {
    const res = await request(app)
      .post('/api/documentation-templates')
      .set(bearer(admin))
      .send({ titulo: 'Reinicio de equipo', contenido: 'Se reinició el equipo y volvió a funcionar', contextos: ['cierre_ticket', 'completar_actividad'] });

    expect(res.status).toBe(201);
    templateId = res.body.data.id;
  });

  it('un técnico puede leer la lista filtrada por contexto (solo activas)', async () => {
    const cierre = await request(app).get('/api/documentation-templates').set(bearer(tecnico)).query({ contexto: 'cierre_ticket' });
    expect(cierre.status).toBe(200);
    expect(cierre.body.data.some((t: { id: string }) => t.id === templateId)).toBe(true);

    const pausa = await request(app).get('/api/documentation-templates').set(bearer(tecnico)).query({ contexto: 'motivo_pausa' });
    expect(pausa.body.data.some((t: { id: string }) => t.id === templateId)).toBe(false);
  });

  it('un admin puede desactivarla y deja de aparecer en la lista filtrada', async () => {
    const upd = await request(app).put(`/api/documentation-templates/${templateId}`).set(bearer(admin)).send({ activo: false });
    expect(upd.status).toBe(200);

    const list = await request(app).get('/api/documentation-templates').set(bearer(tecnico)).query({ contexto: 'cierre_ticket' });
    expect(list.body.data.some((t: { id: string }) => t.id === templateId)).toBe(false);
  });
});
