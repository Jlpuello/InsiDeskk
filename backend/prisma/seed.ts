import { getPrismaClient, disconnectPrisma } from '../src/shared/prisma/client.js';
import { encryptionService } from '../src/shared/utils/encryption.js';

const prisma = getPrismaClient();

async function main() {
  console.log('Seeding database...');

  const company = await prisma.company.create({
    data: {
      nombre: 'Mi Empresa Prueba',
      emailContacto: 'contacto@empresa.com',
      telefono: '3001234567',
      direccion: 'Carrera 1 # 1-1',
      ciudad: 'Cartagena',
      pais: 'Colombia',
    },
  });
  console.log('Company created:', company.id);

  const adminPassword = await encryptionService.hashPassword('Admin123!@#');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@empresa.com',
      passwordHash: adminPassword,
      nombre: 'Admin',
      rol: 'admin',
      empresaId: company.id,
    },
  });
  console.log('Admin user created:', admin.id);

  const techPassword = await encryptionService.hashPassword('Tech123!@#');
  const tech = await prisma.user.create({
    data: {
      email: 'tecnico@empresa.com',
      passwordHash: techPassword,
      nombre: 'Juan',
      apellido: 'Pérez',
      rol: 'tecnico',
      empresaId: company.id,
    },
  });
  console.log('Technician user created:', tech.id);

  const clientPassword = await encryptionService.hashPassword('Cliente123!@#');
  const client = await prisma.user.create({
    data: {
      email: 'cliente@empresa.com',
      passwordHash: clientPassword,
      nombre: 'Cliente',
      apellido: 'Demo',
      rol: 'cliente',
      empresaId: company.id,
    },
  });
  console.log('Client user created:', client.id);

  const device = await prisma.device.create({
    data: {
      nombre: 'PC Cliente 1',
      hostname: 'CLIENTE-PC-001',
      ipLocal: '192.168.1.100',
      empresaId: company.id,
      remotelyId: 'rc-001',
      so: 'Windows',
      versionSo: '11 Pro',
      cpuCores: 8,
      ramGb: 16,
      discoGb: 512,
      estado: 'offline',
    },
  });
  console.log('Device created:', device.id);

  const ticket = await prisma.ticket.create({
    data: {
      titulo: 'Problema con conexión a internet',
      descripcion: 'El cliente reporta que no tiene conexión',
      empresaId: company.id,
      usuarioReporterId: admin.id,
      usuarioAsignadoId: tech.id,
      dispositivoId: device.id,
      prioridad: 'alta',
      estado: 'abierto',
    },
  });
  console.log('Ticket created:', ticket.id);

  console.log('Seed completed!');
  console.log('Credenciales de prueba (contraseña entre paréntesis):');
  console.log('  admin@empresa.com    (Admin123!@#)');
  console.log('  tecnico@empresa.com  (Tech123!@#)');
  console.log('  cliente@empresa.com  (Cliente123!@#)');
}

main()
  .then(async () => {
    await disconnectPrisma();
  })
  .catch(async (e) => {
    console.error(e);
    await disconnectPrisma();
    process.exit(1);
  });
