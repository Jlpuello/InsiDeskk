import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';

export interface JwtPayload {
  id: string;
  email: string;
  rol: string;
  empresaId?: string;
  // Comparado contra el valor real del usuario en cada request (ver
  // authMiddleware.ts) — se bumpea al cambiar contraseña o tocar el 2FA, así
  // un token ya emitido (robado o no) queda invalidado de inmediato en vez de
  // seguir funcionando hasta que expire solo (los refresh token son JWT sin
  // estado, no hay tabla de sesiones que borrar).
  tokenVersion: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// Token de corta vida para el paso intermedio "contraseña OK, falta el
// código 2FA" (ver AuthService.login/loginWithTwoFactor) — a propósito NO
// tiene forma de JwtPayload (sin rol/tokenVersion): así, aunque alguien lo
// mande como si fuera un token de sesión normal, verifyJWT lo rechaza antes
// de autenticar nada (ver el chequeo de forma en authMiddleware.ts).
export interface TwoFactorPendingPayload {
  purpose: 'login_2fa';
  userId: string;
}

const TWO_FACTOR_PENDING_TTL = '5m';

function toPayload(user: Pick<User, 'id' | 'email' | 'rol' | 'empresaId' | 'tokenVersion'>): JwtPayload {
  return {
    id: user.id,
    email: user.email,
    rol: user.rol,
    empresaId: user.empresaId ?? undefined,
    tokenVersion: user.tokenVersion,
  };
}

export const jwtService = {
  generateTokens(user: Pick<User, 'id' | 'email' | 'rol' | 'empresaId' | 'tokenVersion'>): AuthTokens {
    const payload = toPayload(user);
    // env.jwtExpiresIn es un `string` genérico (viene de .env); jsonwebtoken@9
    // tipa expiresIn como `number | StringValue` (literal tipo "1h"), de ahí el cast.
    return {
      accessToken: jwt.sign(payload, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      }),
      refreshToken: jwt.sign(payload, env.jwtRefreshSecret, {
        expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
      }),
    };
  },

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  },

  verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, env.jwtRefreshSecret) as JwtPayload;
  },

  generateTwoFactorPendingToken(userId: string): string {
    const payload: TwoFactorPendingPayload = { purpose: 'login_2fa', userId };
    return jwt.sign(payload, env.jwtSecret, { expiresIn: TWO_FACTOR_PENDING_TTL });
  },

  verifyTwoFactorPendingToken(token: string): TwoFactorPendingPayload {
    const payload = jwt.verify(token, env.jwtSecret) as Partial<TwoFactorPendingPayload>;
    if (payload.purpose !== 'login_2fa' || !payload.userId) {
      throw new Error('Token de 2FA inválido');
    }
    return payload as TwoFactorPendingPayload;
  },
};
