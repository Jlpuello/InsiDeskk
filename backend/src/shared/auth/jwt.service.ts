import jwt from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';

export interface JwtPayload {
  id: string;
  email: string;
  rol: string;
  empresaId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function toPayload(user: Pick<User, 'id' | 'email' | 'rol' | 'empresaId'>): JwtPayload {
  return { id: user.id, email: user.email, rol: user.rol, empresaId: user.empresaId ?? undefined };
}

export const jwtService = {
  generateTokens(user: Pick<User, 'id' | 'email' | 'rol' | 'empresaId'>): AuthTokens {
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
};
