import crypto from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env.js';
import type { AuthTokens } from './jwt.service.js';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const UNITS_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

// JWT_EXPIRES_IN / JWT_REFRESH_EXPIRES_IN vienen como "1h" / "7d" — la cookie
// tiene que vencer junto con el token que lleva, no antes ni después.
function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return fallbackMs;
  return Number(match[1]) * UNITS_MS[match[2]];
}

const accessMaxAge = durationToMs(env.jwtExpiresIn, UNITS_MS.h);
const refreshMaxAge = durationToMs(env.jwtRefreshExpiresIn, 7 * UNITS_MS.d);

function baseOptions(): CookieOptions {
  return { sameSite: 'lax', secure: env.cookieSecure, path: '/' };
}

export function setSessionCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, { ...baseOptions(), httpOnly: true, maxAge: accessMaxAge });
  // path acotado: el refresh token solo viaja a /api/auth, no a cada request.
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(),
    httpOnly: true,
    path: '/api/auth',
    maxAge: refreshMaxAge,
  });
  // Legible por JS a propósito (double-submit): el frontend la copia al header
  // X-CSRF-Token. No es un secreto de sesión — sin el access token httpOnly no sirve.
  res.cookie(CSRF_COOKIE, crypto.randomBytes(24).toString('hex'), {
    ...baseOptions(),
    httpOnly: false,
    maxAge: refreshMaxAge,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), httpOnly: true });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), httpOnly: true, path: '/api/auth' });
  res.clearCookie(CSRF_COOKIE, { ...baseOptions(), httpOnly: false });
}

// Comparación en tiempo constante del header contra la cookie (double-submit).
export function isCsrfValid(req: Request): boolean {
  const cookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const header = req.get(CSRF_HEADER);
  if (!cookie || !header) return false;
  const a = Buffer.from(cookie);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Sockets no pasan por cookie-parser — parseo mínimo del header Cookie del
// handshake de Socket.IO.
export function readCookieFromHeader(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
