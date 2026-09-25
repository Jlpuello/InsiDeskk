import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { TEST_PASSWORD, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Smoke test de integración: pega contra la DB/Redis reales de dev (mismo
// criterio que las verificaciones manuales hechas durante el desarrollo),
// no una base de datos de test separada — crea y limpia sus propios datos.
describe('sesión por cookie (login / CSRF / refresh / logout)', () => {
  const app = createApp();
  let user: User;

  beforeAll(async () => {
    user = await createTestUser('cliente');
  });

  afterAll(async () => {
    await deleteTestUsers(user);
    await disconnectPrisma();
    await closeRedisClient();
  });

  function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
    const line = setCookie?.find((c) => c.startsWith(`${name}=`));
    return line?.split(';')[0].slice(name.length + 1);
  }

  async function login() {
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: TEST_PASSWORD });
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    return { res, setCookie, csrf: cookieValue(setCookie, 'csrf_token') as string };
  }

  it('login: setea cookies httpOnly y NO devuelve tokens en el body', async () => {
    const { res, setCookie } = await login();

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();

    const access = setCookie.find((c) => c.startsWith('access_token='))!;
    const refresh = setCookie.find((c) => c.startsWith('refresh_token='))!;
    const csrf = setCookie.find((c) => c.startsWith('csrf_token='))!;
    expect(access).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\/api\/auth/i);
    expect(csrf).not.toMatch(/HttpOnly/i);
  });

  it('rechaza contraseña incorrecta y email inexistente con 401', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: user.email, password: 'incorrecta' });
    expect(bad.status).toBe(401);

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: `no-existe-${randomUUID()}@example.com`, password: TEST_PASSWORD });
    expect(unknown.status).toBe(401);
  });

  it('la cookie de sesión autentica un GET sin CSRF', async () => {
    const { setCookie } = await login();
    const res = await request(app).get('/api/tickets').set('Cookie', setCookie);
    expect(res.status).toBe(200);
  });

  it('un POST autenticado por cookie sin X-CSRF-Token da 403', async () => {
    const { setCookie } = await login();
    const res = await request(app).post('/api/tickets').set('Cookie', setCookie).send({});
    expect(res.status).toBe(403);
  });

  it('con el X-CSRF-Token correcto el POST pasa el chequeo CSRF (llega a validación, 422)', async () => {
    const { setCookie, csrf } = await login();
    const res = await request(app).post('/api/tickets').set('Cookie', setCookie).set('X-CSRF-Token', csrf).send({});
    expect(res.status).toBe(422);
  });

  it('un X-CSRF-Token que no coincide con la cookie da 403', async () => {
    const { setCookie } = await login();
    const res = await request(app).post('/api/tickets').set('Cookie', setCookie).set('X-CSRF-Token', 'otro').send({});
    expect(res.status).toBe(403);
  });

  it('sin cookie ni Bearer da 401; con Bearer (cliente no-browser) no exige CSRF', async () => {
    expect((await request(app).get('/api/tickets')).status).toBe(401);

    const { jwtService } = await import('../../../shared/auth/jwt.service.js');
    const { accessToken } = jwtService.generateTokens(user);
    const res = await request(app).get('/api/tickets').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it('refresh por cookie renueva las cookies (exige CSRF); sin CSRF da 403', async () => {
    const { setCookie, csrf } = await login();

    const denied = await request(app).post('/api/auth/refresh').set('Cookie', setCookie);
    expect(denied.status).toBe(403);

    const ok = await request(app).post('/api/auth/refresh').set('Cookie', setCookie).set('X-CSRF-Token', csrf);
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeUndefined();
    expect((ok.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('access_token='))).toBe(true);
  });

  it('logout borra las tres cookies', async () => {
    const { setCookie, csrf } = await login();
    const res = await request(app).post('/api/auth/logout').set('Cookie', setCookie).set('X-CSRF-Token', csrf);

    expect(res.status).toBe(200);
    const cleared = res.headers['set-cookie'] as unknown as string[];
    for (const name of ['access_token', 'refresh_token', 'csrf_token']) {
      expect(cleared.find((c) => c.startsWith(`${name}=;`))).toBeDefined();
    }
  });
});
