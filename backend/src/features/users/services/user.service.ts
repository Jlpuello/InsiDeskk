import { userRepository } from '../repositories/user.repository.js';
import { AppError, NotFoundError } from '../../../shared/utils/error.handler.js';
import { resolveEmpresaId } from '../../../shared/security/tenant-scope.js';
import { recordCriticalAction } from '../../../shared/security/critical-action.service.js';
import { encryptionService } from '../../../shared/utils/encryption.js';
import { tokenVersionService } from '../../../shared/auth/token-version.service.js';
import type { CreateUserInput, UpdateUserInput, UserSummary } from '../types/user.types.js';
import type { User } from '@prisma/client';

// A diferencia de Ticket/Device, el modelo User no pasa por el middleware RBAC
// de Prisma (shared/prisma/middleware/rbac.middleware.ts) — se resuelve acá
// mismo, vía resolveEmpresaId (shared/security/tenant-scope.ts): admin ve lo
// que pida (o todo, sin filtro), cliente/tecnico quedan forzados a su propia
// empresa sin importar qué empresaId manden.

export class UserService {
  async list(empresaIdInput?: string): Promise<UserSummary[]> {
    const empresaId = resolveEmpresaId(empresaIdInput);
    const users = empresaId ? await userRepository.findByCompanyId(empresaId) : await userRepository.findMany();
    return users.map(this.toSummary);
  }

  // Alta manual desde Usuarios (a diferencia de /auth/register, que solo crea
  // clientes sin empresa) — acá el admin elige rol y empresa desde el
  // arranque, y define una contraseña temporal que el usuario puede cambiar
  // después (no hay flujo de "cambiar mi contraseña" todavía, así que por
  // ahora se la damos escrita en la UI, ver CreateUserModal).
  async create(input: CreateUserInput): Promise<UserSummary> {
    const existing = await userRepository.findByEmail(input.email);
    if (existing) throw new AppError('El email ya está registrado', 409);

    const validation = encryptionService.validatePassword(input.password);
    if (!validation.valid) {
      throw new AppError('La contraseña no cumple los requisitos', 422, { errors: validation.errors });
    }

    const passwordHash = await encryptionService.hashPassword(input.password);

    const created = await userRepository.create({
      nombre: input.nombre,
      apellido: input.apellido,
      email: input.email,
      passwordHash,
      rol: input.rol,
      nivel: input.nivel ?? null,
      permisos: input.permisos ?? [],
      activo: true,
      ...(input.empresaId && { empresa: { connect: { id: input.empresaId } } }),
    });

    return this.toSummary(created);
  }

  // Cambiar el rol o los permisos es acción crítica — exige motivo y queda
  // auditado con detalle (ver shared/security/critical-action.service.ts),
  // mismo criterio que aprobar/rechazar una cotización. `motivo` solo es
  // obligatorio cuando el valor realmente cambia respecto al existente — el
  // resto de los campos (nombre, nivel, activo) se editan libremente.
  async update(id: string, input: UpdateUserInput & { motivo?: string }): Promise<UserSummary> {
    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError('Usuario');

    const { motivo, ...data } = input;
    const isRoleChange = data.rol !== undefined && data.rol !== existing.rol;

    // `permisos` en Prisma.UserUpdateInput admite tanto un array plano como
    // `{ set: [...] }` — acá siempre llega lo primero (así lo valida Joi en
    // el controller), pero el tipo es unión; se angosta antes de comparar.
    const permisos = Array.isArray(data.permisos) ? data.permisos : undefined;
    const permisosAgregados = permisos?.filter((p) => !existing.permisos.includes(p)) ?? [];
    const permisosQuitados = existing.permisos.filter((p) => permisos && !permisos.includes(p));
    const isPermisosChange = permisosAgregados.length > 0 || permisosQuitados.length > 0;

    if ((isRoleChange || isPermisosChange) && !motivo?.trim()) {
      throw new AppError('Esta acción requiere indicar un motivo', 422);
    }

    const updated = await userRepository.update(id, data);

    if (isRoleChange) {
      await recordCriticalAction({
        accion: 'ROLE_CHANGE',
        tabla: 'User',
        registroId: id,
        motivo: `${existing.rol} → ${data.rol}: ${motivo!.trim()}`,
      });
    }

    if (isPermisosChange) {
      const detalle = [
        permisosAgregados.length > 0 && `+${permisosAgregados.join(', +')}`,
        permisosQuitados.length > 0 && `-${permisosQuitados.join(', -')}`,
      ].filter(Boolean).join(' | ');

      await recordCriticalAction({
        accion: 'PERMISOS_CHANGE',
        tabla: 'User',
        registroId: id,
        motivo: `${detalle}: ${motivo!.trim()}`,
      });
    }

    return this.toSummary(updated);
  }

  // Borrado — acción crítica: exige motivo y queda auditado con detalle,
  // mismo criterio que borrar un ticket/dispositivo (antes esto no pedía
  // motivo, inconsistente con el resto de las acciones críticas).
  async remove(id: string, motivo: string): Promise<void> {
    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError('Usuario');

    await userRepository.delete(id);
    await recordCriticalAction({
      accion: 'USER_DELETE',
      tabla: 'User',
      registroId: id,
      motivo: `${existing.email} (${existing.rol}): ${motivo}`,
    });
  }

  // Para cuando alguien con 2FA queda bloqueado (perdió el teléfono y no
  // guardó los códigos de respaldo) — un admin lo resetea sin necesitar la
  // contraseña de esa persona, justo porque no puede entrar. Acción crítica:
  // exige motivo (mismo criterio que cambiar rol/permisos/borrar) además del
  // auto-audit genérico. Bumpea tokenVersion: si la cuenta resuelta ya tenía
  // una sesión activa en algún lado, queda cerrada (el estado de 2FA cambió
  // de fondo, no tiene sentido que una sesión vieja seguía corriendo como si
  // nada). Si la cuenta es admin, el guard de App.tsx la va a forzar a
  // configurarlo de nuevo apenas vuelva a loguearse.
  async resetTwoFactor(id: string, motivo: string): Promise<UserSummary> {
    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError('Usuario');
    if (!existing.twoFactorEnabled) {
      throw new AppError('Este usuario no tiene 2FA activo', 422);
    }

    const updated = await userRepository.update(id, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    });
    await tokenVersionService.bump(id);

    await recordCriticalAction({
      accion: 'TWO_FACTOR_RESET',
      tabla: 'User',
      registroId: id,
      motivo: `${existing.email}: ${motivo.trim()}`,
    });

    return this.toSummary(updated);
  }

  private toSummary(user: User & { empresa?: { nombre: string } | null }): UserSummary {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      activo: user.activo,
      empresaId: user.empresaId ?? undefined,
      empresaNombre: user.empresa?.nombre,
      nivel: user.nivel,
      permisos: user.permisos,
      twoFactorEnabled: user.twoFactorEnabled,
    };
  }
}

export const userService = new UserService();
