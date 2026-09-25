import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';

// Smoke test de integración contra la DB/Redis reales de dev — cubre el
// camino sin Turnstile (NIT ya registrado), que es el que menos fricción
// tiene y por lo tanto el que más tráfico real recibe.
describe('POST /api/public/tickets', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  // Dígitos únicos (NIT_FORMAT exige solo números, 5 a 15 dígitos).
  const nit = String(Date.now()).slice(-10);
  const nombreEmpresa = `Smoke Test Co ${randomUUID()}`;
  let empresaId: string;
  let ticketId: string | undefined;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { nombre: nombreEmpresa, nit } });
    empresaId = company.id;
  });

  afterAll(async () => {
    if (ticketId) await prisma.ticket.delete({ where: { id: ticketId } });
    await prisma.company.delete({ where: { id: empresaId } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('crea un ticket sin turnstileToken cuando el NIT ya está registrado', async () => {
    const res = await request(app)
      .post('/api/public/tickets')
      .send({
        nit,
        titulo: 'Smoke test — no anda la impresora',
        descripcion: 'Generado por el smoke test automatizado',
        reporterNombre: 'Smoke Test',
        reporterEmail: 'smoke@test.local',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.titulo).toContain('Smoke test');
    expect(res.body.data.empresaId).toBe(empresaId);
    ticketId = res.body.data.id;
  });

  it('rechaza sin turnstileToken cuando el NIT NO está registrado (autoprovisión requiere captcha)', async () => {
    const res = await request(app)
      .post('/api/public/tickets')
      .send({
        nit: String(Date.now()).slice(-10) + '1',
        nombreEmpresa: 'Empresa Nueva Smoke Test',
        titulo: 'No debería crearse',
        reporterNombre: 'Smoke Test',
        reporterEmail: 'smoke@test.local',
      });

    expect(res.status).toBe(422);
  });
});
