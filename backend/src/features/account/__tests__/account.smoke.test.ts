import request from 'supertest';
import type { User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { disconnectPrisma, getPrismaClient } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { TEST_PASSWORD, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';
import { totpService } from '../../../shared/auth/totp.service.js';

// Smoke test de integración (DB/Redis reales de dev, igual criterio que
// auth.smoke.test.ts) — cubre cambio de contraseña, activar/desactivar 2FA,
// el segundo paso de login con 2FA, códigos de respaldo, y que ambas
// acciones revocan la sesión vieja (tokenVersion).
describe('cuenta: contraseña, 2FA y revocación de sesión', () => {
  const app = createApp();
  let user: User;
  let admin: User;

  beforeAll(async () => {
    user = await createTestUser('cliente');
    admin = await createTestUser('admin');
  });

  afterAll(async () => {
    await deleteTestUsers(user, admin);
    await disconnectPrisma();
    await closeRedisClient();
  });

  function cookieValue(setCookie: string[] | undefined, name: string): string | undefined {
    const line = setCookie?.find((c) => c.startsWith(`${name}=`));
    return line?.split(';')[0].slice(name.length + 1);
  }

  // `setCookie`/`csrf` solo existen si el login NO pidió 2FA (ver
  // requiresTwoFactor en `res.body.data`) — los tests que esperan ese caso
  // leen `res.body` directo y nunca pasan estos dos a `.set('Cookie', ...)`,
  // así que el cast a non-null acá abajo es seguro para el resto de los usos.
  async function login(email: string, password = TEST_PASSWORD) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    return { res, setCookie: setCookie as string[], csrf: setCookie ? (cookieValue(setCookie, 'csrf_token') as string) : undefined };
  }

  function secretFromOtpauthUrl(otpauthUrl: string): string {
    return new URL(otpauthUrl).searchParams.get('secret')!;
  }

  it('cambiar contraseña exige la actual, valida la nueva, y revoca la sesión vieja', async () => {
    const { setCookie, csrf } = await login(user.email);

    const wrongCurrent = await request(app)
      .post('/api/account/password')
      .set('Cookie', setCookie)
      .set('X-CSRF-Token', csrf!)
      .send({ currentPassword: 'incorrecta', newPassword: 'Nueva123!@#' });
    expect(wrongCurrent.status).toBe(401);

    const weakNew = await request(app)
      .post('/api/account/password')
      .set('Cookie', setCookie)
      .set('X-CSRF-Token', csrf!)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'débil' });
    expect(weakNew.status).toBe(422);

    const ok = await request(app)
      .post('/api/account/password')
      .set('Cookie', setCookie)
      .set('X-CSRF-Token', csrf!)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'Nueva123!@#' });
    expect(ok.status).toBe(200);

    // La cookie vieja (de antes del cambio) ya no sirve — tokenVersion bumpeado.
    const withOldCookie = await request(app).get('/api/account/security').set('Cookie', setCookie);
    expect(withOldCookie.status).toBe(401);

    // La cookie nueva (de la respuesta del cambio) sí funciona.
    const newCookie = ok.headers['set-cookie'] as unknown as string[];
    const withNewCookie = await request(app).get('/api/account/security').set('Cookie', newCookie);
    expect(withNewCookie.status).toBe(200);

    // Vuelve a dejar la contraseña original — los tests siguientes de este
    // archivo reusan `user` y loguean con TEST_PASSWORD.
    const { encryptionService } = await import('../../../shared/utils/encryption.js');
    await getPrismaClient().user.update({
      where: { id: user.id },
      data: { passwordHash: await encryptionService.hashPassword(TEST_PASSWORD) },
    });
  });

  it('activar 2FA exige un código válido, devuelve 10 códigos de respaldo, y login pide el segundo factor', async () => {
    const { setCookie, csrf } = await login(user.email);

    const setup = await request(app).post('/api/account/2fa/setup').set('Cookie', setCookie).set('X-CSRF-Token', csrf!);
    expect(setup.status).toBe(200);
    const secret = secretFromOtpauthUrl(setup.body.data.otpauthUrl);
    expect(setup.body.data.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);

    const badCode = await request(app)
      .post('/api/account/2fa/verify')
      .set('Cookie', setCookie)
      .set('X-CSRF-Token', csrf!)
      .send({ code: '000000' });
    expect(badCode.status).toBe(401);

    const goodCode = await totpService.generateToken(secret);
    const verify = await request(app)
      .post('/api/account/2fa/verify')
      .set('Cookie', setCookie)
      .set('X-CSRF-Token', csrf!)
      .send({ code: goodCode });
    expect(verify.status).toBe(200);
    expect(verify.body.data.backupCodes).toHaveLength(10);
    const backupCodes: string[] = verify.body.data.backupCodes;

    // Login ahora pide 2FA, no emite cookies todavía.
    const loginAttempt = await login(user.email);
    expect(loginAttempt.res.status).toBe(200);
    expect(loginAttempt.res.body.data.requiresTwoFactor).toBe(true);
    expect(loginAttempt.res.headers['set-cookie']).toBeUndefined();
    const pendingToken = loginAttempt.res.body.data.pendingToken as string;

    const wrongTotp = await request(app).post('/api/auth/login/2fa').send({ pendingToken, code: '000000' });
    expect(wrongTotp.status).toBe(401);

    const freshCode = await totpService.generateToken(secret);
    const okTotp = await request(app).post('/api/auth/login/2fa').send({ pendingToken, code: freshCode });
    expect(okTotp.status).toBe(200);
    expect((okTotp.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('access_token='))).toBe(true);

    // Código de respaldo: sirve una vez, la segunda vez el mismo código falla.
    const loginAttempt2 = await login(user.email);
    const pendingToken2 = loginAttempt2.res.body.data.pendingToken as string;
    const firstUse = await request(app).post('/api/auth/login/2fa').send({ pendingToken: pendingToken2, code: backupCodes[0] });
    expect(firstUse.status).toBe(200);

    const loginAttempt3 = await login(user.email);
    const pendingToken3 = loginAttempt3.res.body.data.pendingToken as string;
    const secondUse = await request(app).post('/api/auth/login/2fa').send({ pendingToken: pendingToken3, code: backupCodes[0] });
    expect(secondUse.status).toBe(401);
  });

  it('un admin no puede desactivar su propio 2FA; un cliente/técnico sí (con la contraseña actual)', async () => {
    const { encryptionService } = await import('../../../shared/utils/encryption.js');

    // El `user` de este archivo ya tiene 2FA activo desde el test anterior —
    // login() acá NO devuelve cookies (pide 2FA), así que el CSRF real hay
    // que sacarlo recién de la respuesta del segundo paso (login/2fa), no del
    // primero.
    const { res: loginRes } = await login(user.email);
    const secretRow = await getPrismaClient().user.findUniqueOrThrow({ where: { id: user.id } });
    const code = await totpService.generateToken(encryptionService.decrypt(secretRow.twoFactorSecret!));
    const fullLogin = await request(app).post('/api/auth/login/2fa').send({ pendingToken: loginRes.body.data.pendingToken, code });
    const sessionCookie = fullLogin.headers['set-cookie'] as unknown as string[];
    const csrf = cookieValue(sessionCookie, 'csrf_token') as string;

    const disable = await request(app)
      .post('/api/account/2fa/disable')
      .set('Cookie', sessionCookie)
      .set('X-CSRF-Token', csrf)
      .send({ currentPassword: TEST_PASSWORD });
    expect(disable.status).toBe(200);

    const status = await request(app).get('/api/account/security').set('Cookie', disable.headers['set-cookie'] as unknown as string[]);
    expect(status.body.data.twoFactorEnabled).toBe(false);

    // Admin: forzamos 2FA activo directo en DB (sin pasar por todo el setup) y confirmamos el bloqueo.
    const adminSecret = totpService.generateSecret();
    await getPrismaClient().user.update({
      where: { id: admin.id },
      data: { twoFactorEnabled: true, twoFactorSecret: encryptionService.encrypt(adminSecret) },
    });
    const { res: adminLoginRes } = await login(admin.email);
    const adminCode = await totpService.generateToken(adminSecret);
    const adminFullLogin = await request(app)
      .post('/api/auth/login/2fa')
      .send({ pendingToken: adminLoginRes.body.data.pendingToken, code: adminCode });
    const adminSessionCookie = adminFullLogin.headers['set-cookie'] as unknown as string[];
    const adminCsrf = cookieValue(adminSessionCookie, 'csrf_token') as string;

    const adminDisable = await request(app)
      .post('/api/account/2fa/disable')
      .set('Cookie', adminSessionCookie)
      .set('X-CSRF-Token', adminCsrf)
      .send({ currentPassword: TEST_PASSWORD });
    expect(adminDisable.status).toBe(403);

    const adminStatus = await request(app).get('/api/account/security').set('Cookie', adminSessionCookie);
    expect(adminStatus.body.data.twoFactorEnabled).toBe(true);
  });

  it('revoke-others cierra la sesión vieja y deja viva la que acaba de pedirlo', async () => {
    const plainUser = await createTestUser('cliente');
    try {
      const { setCookie, csrf } = await login(plainUser.email);
      const revoke = await request(app)
        .post('/api/account/sessions/revoke-others')
        .set('Cookie', setCookie)
        .set('X-CSRF-Token', csrf!);
      expect(revoke.status).toBe(200);

      const oldStillWorks = await request(app).get('/api/account/security').set('Cookie', setCookie);
      expect(oldStillWorks.status).toBe(401);

      const newCookie = revoke.headers['set-cookie'] as unknown as string[];
      const newWorks = await request(app).get('/api/account/security').set('Cookie', newCookie);
      expect(newWorks.status).toBe(200);
    } finally {
      await deleteTestUsers(plainUser);
    }
  });
});
