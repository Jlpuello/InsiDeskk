import { apiClient } from '../../../shared/api/client.ts';
import type { UserRole, UserSummary } from '../types/user.types.ts';

interface UpdateUserInput {
  nombre?: string;
  activo?: boolean;
  nivel?: number | null;
  permisos?: string[];
  // Cambiar `rol` exige `motivo` — el backend lo valida (ver
  // UserController.updateSchema), es acción crítica y queda auditada.
  rol?: UserRole;
  motivo?: string;
}

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

export const userApi = {
  async list(empresaId?: string): Promise<UserSummary[]> {
    const { data } = await apiClient.get<{ data: UserSummary[] }>('/users', { params: { empresaId } });
    return data.data;
  },

  // Alta manual desde Usuarios — a diferencia de /auth/register (que solo
  // crea clientes sin empresa), acá el admin elige rol/empresa/contraseña
  // temporal desde el arranque.
  async create(input: CreateUserInput): Promise<UserSummary> {
    const { data } = await apiClient.post<{ data: UserSummary }>('/users', input);
    return data.data;
  },

  async update(id: string, input: UpdateUserInput): Promise<UserSummary> {
    const { data } = await apiClient.put<{ data: UserSummary }>(`/users/${id}`, input);
    return data.data;
  },

  // Acción crítica — el backend exige motivo y la audita (ver
  // UserService.remove).
  async remove(id: string, motivo: string): Promise<void> {
    await apiClient.delete(`/users/${id}`, { data: { motivo } });
  },
};
