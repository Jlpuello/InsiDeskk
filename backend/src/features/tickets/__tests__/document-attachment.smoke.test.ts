import request from 'supertest';
import type { Company, User } from '@prisma/client';
import { createApp } from '../../../app.js';
import { getPrismaClient, disconnectPrisma } from '../../../shared/prisma/client.js';
import { closeRedisClient } from '../../../config/redis.js';
import { jwtService } from '../../../shared/auth/jwt.service.js';
import { ticketService } from '../services/ticket.service.js';
import { createTestCompany, createTestUser, deleteTestUsers } from '../../../shared/testing/fixtures.js';

// Antes de este cambio, ticketCloseUpload solo aceptaba JPG/PNG/WEBP — ahora
// también PDF/Word/Excel (ver ticket-upload.middleware.ts).
describe('adjuntar un documento (no solo fotos) al cerrar un ticket', () => {
  const app = createApp();
  const prisma = getPrismaClient();
  let company: Company;
  let tecnico: User;
  let ticketId: string;

  const bearer = (u: User) => ({ Authorization: `Bearer ${jwtService.generateTokens(u).accessToken}` });
  const fakePdf = Buffer.from('%PDF-1.4\n%fake pdf content for a smoke test\n%%EOF');

  beforeAll(async () => {
    company = await createTestCompany();
    tecnico = await createTestUser('tecnico', company.id);
    const ticket = await ticketService.createTicket({
      titulo: 'Ticket con adjunto PDF',
      empresaId: company.id,
      usuarioReporterId: tecnico.id,
    });
    await ticketService.changeTicketStatus(ticket.id, 'en_progreso');
    ticketId = ticket.id;
  });

  afterAll(async () => {
    await prisma.note.deleteMany({ where: { ticket: { empresaId: company.id } } });
    await prisma.ticket.deleteMany({ where: { empresaId: company.id } });
    await deleteTestUsers(tecnico);
    await prisma.company.delete({ where: { id: company.id } });
    await disconnectPrisma();
    await closeRedisClient();
  });

  it('rechaza un .txt (formato no permitido)', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/close`)
      .set(bearer(tecnico))
      .field('contenido', 'Se resolvió el problema')
      .attach('imagenes', Buffer.from('solo texto plano'), { filename: 'notas.txt', contentType: 'text/plain' });
    expect(res.status).toBe(422);
  });

  it('acepta un .pdf, conserva el nombre original, y queda descargable', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/close`)
      .set(bearer(tecnico))
      .field('contenido', 'Se resolvió el problema, informe adjunto')
      .attach('imagenes', fakePdf, { filename: 'informe#1.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    const notes = await prisma.note.findMany({ where: { ticketId, tipo: 'cierre' } });
    const adjunto = notes.flatMap((n) => n.adjuntos).find((a) => a.endsWith('.pdf'));
    expect(adjunto).toBeDefined();
    expect(adjunto).toContain('informe_1.pdf'); // saneado: "#" -> "_"

    const download = await request(app).get(`/api${adjunto}`).set(bearer(tecnico));
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('application/pdf');
  });
});
