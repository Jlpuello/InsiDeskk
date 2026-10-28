import type { User } from '@prisma/client';
import { userRepository } from '../../users/repositories/user.repository.js';
import { encryptionService } from '../../../shared/utils/encryption.js';
import { totpService } from '../../../shared/auth/totp.service.js';
import { jwtService, type AuthTokens } from '../../../shared/auth/jwt.service.js';
import { getPrismaClient } from '../../../shared/prisma/client.js';
import { logger } from '../../../shared/utils/logger.js';
import { AppError, UnauthorizedError } from '../../../shared/utils/error.handler.js';

export interface LoginDTO {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

// Lo que devuelve login() cuando la contraseña fue correcta pero falta el
// segundo factor — a propósito NO trae tokens todavía (ver
// jwtService.generateTwoFactorPendingToken: ese token no autentica nada por
// sí solo, authMiddleware lo rechaza explícitamente).
export interface LoginResult {
  requiresTwoFactor: boolean;
  user?: User;
  tokens?: AuthTokens;
  pendingToken?: string;
}

export interface RegisterDTO {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
}

async function recordFailedAttempt(email: string, razon: string, ip?: string, userAgent?: string): Promise<void> {
  try {
    await getPrismaClient().failedLoginAttempt.create({
      data: { email, razon, ipAddress: ip, userAgent },
    });
  } catch (err) {
    logger.error(`No se pudo registrar el intento de login fallido: ${(err as Error).message}`);
  }
}

export class AuthService {
  async register(data: RegisterDTO): Promise<User> {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw new AppError('El email ya está registrado', 409);
    }

    const validation = encryptionService.validatePassword(data.password);
    if (!validation.valid) {
      throw new AppError('La contraseña no cumple los requisitos', 422, { errors: validation.errors });
    }

    const passwordHash = await encryptionService.hashPassword(data.password);

    const user = await userRepository.create({
      email: data.email,
      passwordHash,
      nombre: data.nombre,
      apellido: data.apellido,
      rol: 'cliente',
      activo: true,
    });

    logger.info(`Usuario registrado: ${user.id}`);
    return user;
  }

  async login(data: LoginDTO): Promise<LoginResult> {
    const user = await userRepository.findByEmail(data.email);
    if (!user) {
      await recordFailedAttempt(data.email, 'usuario_no_existe', data.ip, data.userAgent);
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (!user.activo) {
      await recordFailedAttempt(data.email, 'usuario_inactivo', data.ip, data.userAgent);
      throw new UnauthorizedError('El usuario está deshabilitado');
    }

    const isValid = await encryptionService.comparePassword(data.password, user.passwordHash);
    if (!isValid) {
      await recordFailedAttempt(data.email, 'password_incorrecto', data.ip, data.userAgent);
      throw new UnauthorizedError('Credenciales inválidas');
    }

    if (user.twoFactorEnabled) {
      logger.info(`Usuario ${user.id}: contraseña correcta, pendiente 2FA`);
      return { requiresTwoFactor: true, pendingToken: jwtService.generateTwoFactorPendingToken(user.id) };
    }

    await userRepository.update(user.id, { ultimoLogin: new Date() });

    const tokens = jwtService.generateTokens(user);
    logger.info(`Usuario autenticado: ${user.id}`);

    return { requiresTwoFactor: false, user, tokens };
  }

  // Segundo paso del login cuando el usuario tiene 2FA activo (ver login() de
  // arriba) — el pendingToken ya certificó que la contraseña era correcta,
  // acá solo falta el código TOTP (o un código de respaldo de un solo uso).
  async loginWithTwoFactor(pendingToken: string, code: string, ip?: string, userAgent?: string): Promise<{ user: User; tokens: AuthTokens }> {
    let payload;
    try {
      payload = jwtService.verifyTwoFactorPendingToken(pendingToken);
    } catch {
      throw new UnauthorizedError('El código venció — volvé a iniciar sesión');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || !user.activo || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedError();
    }

    const validCode = await totpService.verifyToken(encryptionService.decrypt(user.twoFactorSecret), code);
    if (validCode) {
      await userRepository.update(user.id, { ultimoLogin: new Date() });
      logger.info(`Usuario autenticado (2FA, TOTP): ${user.id}`);
      return { user, tokens: jwtService.generateTokens(user) };
    }

    // Código de respaldo: se compara contra cada hash (bcrypt no permite
    // buscar por valor, hay que probar uno por uno — la lista es corta, 10
    // como mucho) y, si matchea, se CONSUME (se saca del array) antes de
    // devolver los tokens — de un solo uso, igual que cualquier backup code.
    for (const hash of user.twoFactorBackupCodes) {
      if (await encryptionService.comparePassword(code, hash)) {
        await userRepository.update(user.id, {
          ultimoLogin: new Date(),
          twoFactorBackupCodes: user.twoFactorBackupCodes.filter((h) => h !== hash),
        });
        logger.info(`Usuario autenticado (2FA, código de respaldo consumido): ${user.id}`);
        return { user, tokens: jwtService.generateTokens(user) };
      }
    }

    await recordFailedAttempt(user.email, 'codigo_2fa_incorrecto', ip, userAgent);
    throw new UnauthorizedError('Código incorrecto');
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = jwtService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    const user = await userRepository.findById(payload.id);
    if (!user || !user.activo) {
      throw new UnauthorizedError();
    }
    // El refresh token no pasa por verifyJWT (vive en /api/auth, antes de
    // tener sesión completa) — sin este chequeo, un refresh token robado
    // seguiría sirviendo para renovar indefinidamente aunque la contraseña ya
    // se haya cambiado (ver User.tokenVersion).
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedError('Refresh token inválido o expirado');
    }

    return jwtService.generateTokens(user);
  }

  async validateToken(token: string): Promise<User | null> {
    try {
      const payload = jwtService.verifyToken(token);
      return await userRepository.findById(payload.id);
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
