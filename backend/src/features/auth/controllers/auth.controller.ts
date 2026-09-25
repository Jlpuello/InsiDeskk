import type { Request, Response } from 'express';
import Joi from 'joi';
import type { User } from '@prisma/client';
import { authService } from '../services/auth.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';

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

    res.status(200).json({ data: { user: sanitizeUser(user), ...tokens } });
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) throw new AppError('refreshToken es requerido', 422);

    const tokens = await authService.refresh(refreshToken);
    res.status(200).json({ data: tokens });
  },
};
