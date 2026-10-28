import crypto from 'node:crypto';
import type { User } from '@prisma/client';
import { userRepository } from '../../users/repositories/user.repository.js';
import { encryptionService } from '../../../shared/utils/encryption.js';
import { totpService } from '../../../shared/auth/totp.service.js';
import { tokenVersionService } from '../../../shared/auth/token-version.service.js';
import { jwtService, type AuthTokens } from '../../../shared/auth/jwt.service.js';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError, NotFoundError, UnauthorizedError } from '../../../shared/utils/error.handler.js';

const BACKUP_CODE_COUNT = 10;
// Sin 0/O/1/I — se prestan a confusión al tipear a mano desde un papel.
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateBackupCode(): string {
  const bytes = crypto.randomBytes(10);
  let raw = '';
  for (const byte of bytes) {
    raw += BACKUP_CODE_ALPHABET[byte % BACKUP_CODE_ALPHABET.length];
  }
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

async function requireUser(userId: string): Promise<User> {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('Usuario');
  return user;
}

// Reemite tokens con la versión ya actualizada — se usa después de cualquier
// acción que bumpea tokenVersion (cambiar contraseña, tocar el 2FA) para que
// quien acaba de hacer el cambio no quede desconectado de su propia sesión.
async function bumpAndReissue(userId: string): Promise<{ user: User; tokens: AuthTokens }> {
  const user = await tokenVersionService.bump(userId);
  return { user, tokens: jwtService.generateTokens(user) };
}

export interface SecurityStatus {
  twoFactorEnabled: boolean;
  // true si el rol exige 2FA (admin) y todavía no lo activó — el frontend
  // usa esto para forzar la redirección a configurarlo, ver guard en App.tsx.
  twoFactorRequired: boolean;
  recentFailedAttempts: { razon: string; createdAt: Date }[];
}

export interface TwoFactorSetupResult {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export const accountService = {
  async getSecurityStatus(userId: string): Promise<SecurityStatus> {
    const user = await requireUser(userId);

    const recentFailedAttempts = await getPrismaClient().failedLoginAttempt.findMany({
      where: { email: user.email },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { razon: true, createdAt: true },
    });

    return {
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorRequired: user.rol === 'admin' && !user.twoFactorEnabled,
      recentFailedAttempts,
    };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await requireUser(userId);

    const isValid = await encryptionService.comparePassword(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('La contraseña actual no es correcta');

    const validation = encryptionService.validatePassword(newPassword);
    if (!validation.valid) {
      throw new AppError('La contraseña no cumple los requisitos', 422, { errors: validation.errors });
    }

    const passwordHash = await encryptionService.hashPassword(newPassword);
    await userRepository.update(userId, { passwordHash });

    logger.info(`Usuario ${userId} cambió su contraseña`);
    return bumpAndReissue(userId);
  },

  // Genera un secreto nuevo y lo guarda cifrado, pero NO activa el 2FA
  // todavía (twoFactorEnabled sigue false) — recién se activa cuando el
  // usuario confirma el primer código real en verifyTwoFactor. Llamar esto de
  // nuevo antes de confirmar simplemente reemplaza el secreto pendiente
  // anterior (no quedan secretos huérfanos acumulándose).
  async setupTwoFactor(userId: string): Promise<TwoFactorSetupResult> {
    const user = await requireUser(userId);
    if (user.twoFactorEnabled) {
      throw new AppError('El 2FA ya está activo — desactivalo antes de volver a configurarlo', 422);
    }

    const secret = totpService.generateSecret();
    await userRepository.update(userId, { twoFactorSecret: encryptionService.encrypt(secret) });

    const otpauthUrl = totpService.buildOtpauthUrl(secret, user.email);
    const qrCodeDataUrl = await totpService.buildQrCodeDataUrl(otpauthUrl);

    return { otpauthUrl, qrCodeDataUrl };
  },

  // Códigos de respaldo: se devuelven en texto plano UNA sola vez acá — nunca
  // se guardan así (solo su hash bcrypt), no hay forma de volver a verlos
  // después, igual que una contraseña.
  async verifyTwoFactor(userId: string, code: string): Promise<{ backupCodes: string[]; user: User; tokens: AuthTokens }> {
    const user = await requireUser(userId);
    if (!user.twoFactorSecret) {
      throw new AppError('Primero iniciá la configuración del 2FA', 422);
    }

    const valid = await totpService.verifyToken(encryptionService.decrypt(user.twoFactorSecret), code);
    if (!valid) throw new UnauthorizedError('Código incorrecto');

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    const hashedCodes = await Promise.all(backupCodes.map((c) => encryptionService.hashPassword(c)));

    await userRepository.update(userId, { twoFactorEnabled: true, twoFactorBackupCodes: hashedCodes });
    logger.info(`Usuario ${userId} activó 2FA`);

    const { user: fresh, tokens } = await bumpAndReissue(userId);
    return { backupCodes, user: fresh, tokens };
  },

  async disableTwoFactor(userId: string, currentPassword: string): Promise<{ user: User; tokens: AuthTokens }> {
    const user = await requireUser(userId);
    if (user.rol === 'admin') {
      throw new AppError('Los administradores no pueden desactivar el 2FA', 403);
    }

    const isValid = await encryptionService.comparePassword(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedError('La contraseña actual no es correcta');

    await userRepository.update(userId, { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] });
    logger.info(`Usuario ${userId} desactivó 2FA`);

    return bumpAndReissue(userId);
  },

  // Cierra sesión en cualquier otro dispositivo/navegador — bumpea
  // tokenVersion y reemite tokens frescos solo para la sesión actual.
  async revokeOtherSessions(userId: string): Promise<{ user: User; tokens: AuthTokens }> {
    const result = await bumpAndReissue(userId);
    logger.info(`Usuario ${userId} cerró sus otras sesiones`);
    return result;
  },
};
