import type { Prisma } from '@prisma/client';

// Re-exporta tipos de Prisma con los `include` que realmente usan los
// repositorios, para no repetir el mismo objeto de include en cada firma.
export type PrismaTicket = Prisma.TicketGetPayload<Record<string, never>>;

export type TicketWithRelations = Prisma.TicketGetPayload<{
  include: {
    empresa: true;
    usuarioReporter: true;
    usuarioAsignado: true;
    dispositivo: true;
    notas: {
      include: {
        usuario: true;
      };
    };
    historial: {
      include: {
        usuario: true;
      };
    };
    sesionesRemotely: true;
  };
}>;

export type UserWithCompany = Prisma.UserGetPayload<{
  include: {
    empresa: true;
  };
}>;

export type DeviceWithCompany = Prisma.DeviceGetPayload<{
  include: {
    empresa: true;
  };
}>;
