import type { Request, Response } from 'express';
import Joi from 'joi';
import type { User } from '@prisma/client';
import { authService } from '../services/auth.service.js';
import { AppError, ForbiddenError } from '../../../shared/utils/error.handler.js';
import {
  REFRESH_COOKIE,
  clearSessionCookies,
  isCsrfValid,
  setSessionCookies,
} from '../../../shared/auth/session-cookies.js';

const registerSchema = Joi.object({
  nombre: Joi.string().min(2).max(150).required(),
  apellido: Joi.string().max(150),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const loginTwoFactorSchema = Joi.object({
  pendingToken: Joi.string().required(),
  code: Joi.string().min(6).max(11).required(),
});

// El registro/login siempre pasa por Prisma, que devuelve el User completo —
// incluyendo passwordHash y los datos crudos del 2FA. Nunca deben salir en la
// respuesta HTTP (twoFactorEnabled sí, el front lo necesita para saber el
// estado — lo sensible es el secreto y los códigos de respaldo).
function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, twoFactorBackupCodes: _twoFactorBackupCodes, ...safe } = user;
  return safe;
}

export const AuthController = {
  async register(req: Request, res: Response): Promise<void> {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const user = await authService.register(value);
    res.status(201).json({ data: sanitizeUser(user) });
  },

  async login(req: Request, res: Response): Promise<void> {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const result = await authService.login({
      ...value,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    if (result.requiresTwoFactor) {
      res.status(200).json({ data: { requiresTwoFactor: true, pendingToken: result.pendingToken } });
      return;
    }

    // Los tokens viajan solo en cookies httpOnly (ver session-cookies.ts) — el
    // JS del navegador nunca los ve, así un XSS no puede robar la sesión.
    setSessionCookies(res, result.tokens!);
    res.status(200).json({ data: { user: sanitizeUser(result.user!) } });
  },

  // Segundo paso del login cuando hace falta 2FA — ver AuthService.login,
  // que no emite cookies todavía en ese caso.
  async loginTwoFactor(req: Request, res: Response): Promise<void> {
    const { error, value } = loginTwoFactorSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { user, tokens } = await authService.loginWithTwoFactor(
      value.pendingToken,
      value.code,
      req.ip,
      req.headers['user-agent'],
    );

    setSessionCookies(res, tokens);
    res.status(200).json({ data: { user: sanitizeUser(user) } });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const cookieToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const bodyToken = (req.body as { refreshToken?: string } | undefined)?.refreshToken;
    const refreshToken = cookieToken ?? bodyToken;
    if (!refreshToken) throw new AppError('refreshToken es requerido', 422);
    if (cookieToken && !isCsrfValid(req)) throw new ForbiddenError('Falta o es inválido el token CSRF');

    const tokens = await authService.refresh(refreshToken);
    setSessionCookies(res, tokens);
    // Clientes sin cookies (no-browser) siguen recibiendo los tokens en el body.
    res.status(200).json({ data: cookieToken ? { ok: true } : tokens });
  },

  async logout(req: Request, res: Response): Promise<void> {
    if (req.cookies?.[REFRESH_COOKIE] && !isCsrfValid(req)) {
      throw new ForbiddenError('Falta o es inválido el token CSRF');
    }
    clearSessionCookies(res);
    res.status(200).json({ data: { ok: true } });
  },
};
