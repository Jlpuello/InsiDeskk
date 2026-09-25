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

// El registro/login siempre pasa por Prisma, que devuelve el User completo —
// incluyendo passwordHash. Nunca debe salir en la respuesta HTTP.
function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, ...safe } = user;
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

    const { user, tokens } = await authService.login({
      ...value,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Los tokens viajan solo en cookies httpOnly (ver session-cookies.ts) — el
    // JS del navegador nunca los ve, así un XSS no puede robar la sesión.
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
