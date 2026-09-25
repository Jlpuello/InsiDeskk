import type { User } from '@prisma/client';
import { userRepository } from '../../users/repositories/user.repository.js';
import { encryptionService } from '../../../shared/utils/encryption.js';
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

  async login(data: LoginDTO): Promise<{ user: User; tokens: AuthTokens }> {
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

    await userRepository.update(user.id, { ultimoLogin: new Date() });

    const tokens = jwtService.generateTokens(user);
    logger.info(`Usuario autenticado: ${user.id}`);

    return { user, tokens };
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
