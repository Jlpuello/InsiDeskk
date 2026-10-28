import type { Prisma, UserRole } from '@prisma/client';

export type UpdateUserInput = Pick<Prisma.UserUpdateInput, 'nombre' | 'apellido' | 'activo' | 'nivel' | 'permisos'> & {
  rol?: UserRole;
};

export interface CreateUserInput {
  nombre: string;
  apellido?: string;
  email: string;
  password: string;
  rol: UserRole;
  empresaId?: string;
  nivel?: number | null;
  permisos?: string[];
}

export interface UserSummary {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  empresaId?: string;
  empresaNombre?: string;
  nivel: number | null;
  permisos: string[];
  // Para mostrar/ocultar el botón "Resetear 2FA" en Usuarios (admin) — ver
  // UserService.resetTwoFactor.
  twoFactorEnabled: boolean;
}
