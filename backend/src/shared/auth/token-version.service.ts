import type { User } from '@prisma/client';
import { cacheService } from '../cache/cache.service.js';
import { CacheKeys } from '../cache/cache-keys.js';
import { userRepository } from '../../features/users/repositories/user.repository.js';

const TOKEN_VERSION_CACHE_TTL = 60;

// Comparado contra JwtPayload.tokenVersion en cada request (ver
// authMiddleware.ts) — permite revocar sesiones ya emitidas (contraseña
// cambiada, 2FA activado/desactivado, "cerrar otras sesiones") sin depender
// de una tabla de sesiones: los refresh/access token son JWT sin estado.
export const tokenVersionService = {
  // null = el usuario ya no existe, tratado como token inválido.
  async getCurrent(userId: string): Promise<number | null> {
    const cached = await cacheService.get<number>(CacheKeys.user(userId));
    if (cached !== null) return cached;

    const user = await userRepository.findById(userId);
    if (!user) return null;

    await cacheService.set(CacheKeys.user(userId), user.tokenVersion, TOKEN_VERSION_CACHE_TTL);
    return user.tokenVersion;
  },

  // Devuelve el User actualizado (no solo el número) para que el llamador
  // pueda pasárselo directo a jwtService.generateTokens y reemitir cookies
  // en la misma respuesta — ver el comentario de arriba sobre por qué el
  // cache se actualiza acá mismo, no solo la DB.
  async bump(userId: string): Promise<User> {
    const user = await userRepository.update(userId, { tokenVersion: { increment: 1 } });
    await cacheService.set(CacheKeys.user(userId), user.tokenVersion, TOKEN_VERSION_CACHE_TTL);
    return user;
  },
};
