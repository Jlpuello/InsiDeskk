import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { encryptionService } from '../../../shared/utils/encryption.js';

// Smoke test de integración: pega contra la DB/Redis reales de dev (mismo
// criterio que las verificaciones manuales hechas durante el desarrollo),
// no una base de datos de test separada — crea y limpia sus propios datos.
describe('POST /api/auth/login', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  // Joi's .email() sin { tlds: false } rechaza TLDs no reconocidos como
  // ".local" — a diferencia del email de contacto público (que sí desactiva
  // ese chequeo), el login es un email real de usuario, así que .com sirve.
  const email = `smoke-${randomUUID()}@example.com`;
  const password = 'Smoke123!@#';
  let userId: string;

  beforeAll(async () => {
    const passwordHash = await encryptionService.hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, nombre: 'Smoke Test', rol: 'cliente', activo: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.failedLoginAttempt.deleteMany({ where: { email } });
    await prisma.user.delete({ where: { id: userId } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('devuelve tokens y el usuario (sin passwordHash) con credenciales correctas', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(typeof res.body.data.refreshToken).toBe('string');
  });

  it('rechaza una contraseña incorrecta con 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'incorrecta' });
    expect(res.status).toBe(401);
  });

  it('rechaza un email inexistente con 401 (no filtra si el email existe o no)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: `no-existe-${randomUUID()}@example.com`, password });
    expect(res.status).toBe(401);
  });
});
