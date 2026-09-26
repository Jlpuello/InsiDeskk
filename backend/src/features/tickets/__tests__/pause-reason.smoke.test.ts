import request from 'supertest';
import type { Company, User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { jwtService } from '../../../shared/auth/jwt.service.js';
import { ticketService } from '../services/ticket.service.js';
import { createTestCompany, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Reproduce el pedido: pausar un ticket (→ en_espera) debe exigir motivo,
// igual que ya exigen reabrir/eliminar — antes de este cambio no pedía nada.
describe('motivo obligatorio al pausar un ticket', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  let company: Company;
  let tecnico: User;
  let ticketId: string;

  const bearer = (u: User) => ({ Authorization: `Bearer ${jwtService.generateTokens(u).accessToken}` });

  beforeAll(async () => {
    company = await createTestCompany();
    tecnico = await createTestUser('tecnico', company.id);
  });

  beforeEach(async () => {
    const ticket = await ticketService.createTicket({
      titulo: 'Ticket para pausar',
      empresaId: company.id,
      usuarioReporterId: tecnico.id,
    });
    await ticketService.changeTicketStatus(ticket.id, 'en_progreso');
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.ticketHistory.deleteMany({ where: { ticket: { empresaId: company.id } } });
    await prisma.note.deleteMany({ where: { ticket: { empresaId: company.id } } });
    await prisma.ticket.deleteMany({ where: { empresaId: company.id } });
    await deleteTestUsers(tecnico);
    await prisma.company.delete({ where: { id: company.id } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('sin motivo, 422', async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}/estado`).set(bearer(tecnico)).send({ estado: 'en_espera' });
    expect(res.status).toBe(422);
  });

  it('con motivo, pausa y lo deja registrado como Note (tipo pausa) y TicketHistory', async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/estado`)
      .set(bearer(tecnico))
      .send({ estado: 'en_espera', motivo: 'Esperando repuesto del proveedor' });

    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('en_espera');

    const notes = await prisma.note.findMany({ where: { ticketId, tipo: 'pausa' } });
    expect(notes.some((n) => n.contenido === 'Esperando repuesto del proveedor')).toBe(true);

    const history = await prisma.ticketHistory.findMany({ where: { ticketId, campoModificado: 'estado' } });
    expect(history.some((h) => h.valorNuevo === 'en_espera' && h.razon === 'Esperando repuesto del proveedor')).toBe(true);
  });

  it('otras transiciones (ej. cancelado) siguen sin exigir motivo', async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}/estado`).set(bearer(tecnico)).send({ estado: 'cancelado' });
    expect(res.status).toBe(200);
  });
});
