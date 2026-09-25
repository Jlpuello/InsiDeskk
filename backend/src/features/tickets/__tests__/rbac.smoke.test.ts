import request from 'supertest';
import type { Company, User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { jwtService } from '../../../shared/auth/jwt.service.js';
import { createTestCompany, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Permisos por rol y aislamiento entre empresas — el riesgo más caro de un
// helpdesk multi-empresa es que un cliente vea tickets de otro.
describe('RBAC y aislamiento por empresa', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  let companyA: Company;
  let companyB: Company;
  let clienteA: User;
  let admin: User;
  let ticketBId: string;

  const bearer = (u: User) => ({ Authorization: `Bearer ${jwtService.generateTokens(u).accessToken}` });

  beforeAll(async () => {
    companyA = await createTestCompany();
    companyB = await createTestCompany();
    clienteA = await createTestUser('cliente', companyA.id);
    admin = await createTestUser('admin', companyA.id);
    const ticketB = await prisma.ticket.create({
      data: { titulo: 'Ticket de la empresa B', empresaId: companyB.id },
    });
    ticketBId = ticketB.id;
  });

  afterAll(async () => {
    await prisma.ticket.deleteMany({ where: { empresaId: { in: [companyA.id, companyB.id] } } });
    await deleteTestUsers(clienteA, admin);
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('un cliente no puede leer el ticket de otra empresa', async () => {
    const res = await request(app).get(`/api/tickets/${ticketBId}`).set(bearer(clienteA));
    expect([403, 404]).toContain(res.status);
  });

  it('el listado de un cliente no incluye tickets de otras empresas', async () => {
    const res = await request(app).get('/api/tickets').set(bearer(clienteA));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(ticketBId);
  });

  it('un cliente no accede a rutas de administración', async () => {
    for (const path of ['/api/users', '/api/settings/ai', '/api/settings/email', '/api/chatbot/config']) {
      const res = await request(app).get(path).set(bearer(clienteA));
      expect(res.status).toBe(403);
    }
  });

  it('un admin sí accede a configuración, y no ve secretos en claro', async () => {
    const res = await request(app).get('/api/settings/email').set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.smtpPassword).toBeUndefined();
  });

  it('el árbol del chatbot rechaza una opción con siguienteId Y accion a la vez', async () => {
    const res = await request(app)
      .put('/api/chatbot/config')
      .set(bearer(admin))
      .send({
        activo: false,
        arbol: {
          root: 'inicio',
          nodes: { inicio: { mensaje: 'Hola', opciones: [{ texto: 'x', siguienteId: 'inicio', accion: 'fin' }] } },
        },
      });
    expect(res.status).toBe(422);
  });
});
