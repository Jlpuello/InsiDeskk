import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';

// Smoke test de integración contra la DB/Redis reales de dev — Turnstile
// llama a la API real de Cloudflare (sin mocks acá, a propósito), así que no
// hay forma de automatizar un token válido (necesita resolver el widget real
// en un navegador). Por eso este archivo solo puede probar el lado
// "rechazado" del gate, para las dos rutas — no el éxito con un token
// legítimo. La creación real se verificó a mano (Playwright) al implementar
// el cambio.
describe('POST /api/public/tickets', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  // Dígitos únicos (NIT_FORMAT exige solo números, 5 a 15 dígitos).
  const nit = String(Date.now()).slice(-10);
  const nombreEmpresa = `Smoke Test Co ${randomUUID()}`;
  let empresaId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({ data: { nombre: nombreEmpresa, nit } });
    empresaId = company.id;
  });

  afterAll(async () => {
    await prisma.company.delete({ where: { id: empresaId } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  // El NIT no es secreto (está en cualquier factura) — Turnstile se exige
  // SIEMPRE, incluso con una empresa ya registrada, para que no sea la única
  // barrera contra crear tickets a nombre de una empresa ajena.
  it('rechaza sin turnstileToken aunque el NIT ya esté registrado', async () => {
    const res = await request(app)
      .post('/api/public/tickets')
      .send({
        nit,
        titulo: 'Smoke test — no anda la impresora',
        descripcion: 'Generado por el smoke test automatizado',
        reporterNombre: 'Smoke Test',
        reporterEmail: 'smoke@test.local',
      });

    expect(res.status).toBe(422);
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
