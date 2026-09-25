import { randomUUID } from 'node:crypto';
import type { Company, User } from '@prisma/client';
import { getPrismaClient } from '../prisma/client.js';
import { encryptionService } from '../utils/encryption.js';

// Fixtures para los smoke tests de integración (DB real de dev): cada test crea
// sus propios datos con sufijos aleatorios y los borra al terminar.
export const TEST_PASSWORD = 'Smoke123!@#';

export async function createTestCompany(): Promise<Company> {
  return getPrismaClient().company.create({
    data: { nombre: `Smoke Co ${randomUUID()}`, nit: String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90 + 10)) },
  });
}

export async function createTestUser(rol: 'admin' | 'tecnico' | 'cliente', empresaId?: string): Promise<User> {
  return getPrismaClient().user.create({
    data: {
      // .com: el Joi del login rechaza TLDs no reconocidos como ".local".
      email: `smoke-${randomUUID()}@example.com`,
      passwordHash: await encryptionService.hashPassword(TEST_PASSWORD),
      nombre: 'Smoke Test',
      rol,
      activo: true,
      empresaId,
    },
  });
}

export async function deleteTestUsers(...users: User[]): Promise<void> {
  const prisma = getPrismaClient();
  for (const u of users) {
    await prisma.failedLoginAttempt.deleteMany({ where: { email: u.email } });
    await prisma.notification.deleteMany({ where: { usuarioId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
}
