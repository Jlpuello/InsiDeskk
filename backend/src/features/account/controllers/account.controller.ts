import type { Request, Response } from 'express';
import Joi from 'joi';
import type { User } from '@prisma/client';
import { accountService } from '../services/account.service.js';
import { AppError } from '../../../shared/utils/error.handler.js';
import { setSessionCookies } from '../../../shared/auth/session-cookies.js';

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

const verifyTwoFactorSchema = Joi.object({
  code: Joi.string().min(6).max(6).pattern(/^\d+$/).required(),
});

const disableTwoFactorSchema = Joi.object({
  currentPassword: Joi.string().required(),
});

// Mismo criterio que AuthController.sanitizeUser — nunca deben salir en la
// respuesta HTTP el hash de contraseña ni los datos crudos del 2FA.
function sanitizeUser(user: User) {
  const { passwordHash: _passwordHash, twoFactorSecret: _twoFactorSecret, twoFactorBackupCodes: _twoFactorBackupCodes, ...safe } = user;
  return safe;
}

export const AccountController = {
  async getSecurity(req: Request, res: Response): Promise<void> {
    const status = await accountService.getSecurityStatus(req.user!.id);
    res.status(200).json({ data: status });
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { user, tokens } = await accountService.changePassword(req.user!.id, value.currentPassword, value.newPassword);
    setSessionCookies(res, tokens);
    res.status(200).json({ data: { user: sanitizeUser(user) } });
  },

  async setupTwoFactor(req: Request, res: Response): Promise<void> {
    const result = await accountService.setupTwoFactor(req.user!.id);
    res.status(200).json({ data: result });
  },

  async verifyTwoFactor(req: Request, res: Response): Promise<void> {
    const { error, value } = verifyTwoFactorSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { backupCodes, user, tokens } = await accountService.verifyTwoFactor(req.user!.id, value.code);
    setSessionCookies(res, tokens);
    res.status(200).json({ data: { backupCodes, user: sanitizeUser(user) } });
  },

  async disableTwoFactor(req: Request, res: Response): Promise<void> {
    const { error, value } = disableTwoFactorSchema.validate(req.body);
    if (error) throw new AppError(error.message, 422);

    const { user, tokens } = await accountService.disableTwoFactor(req.user!.id, value.currentPassword);
    setSessionCookies(res, tokens);
    res.status(200).json({ data: { user: sanitizeUser(user) } });
  },

  async revokeOtherSessions(req: Request, res: Response): Promise<void> {
    const { user, tokens } = await accountService.revokeOtherSessions(req.user!.id);
    setSessionCookies(res, tokens);
    res.status(200).json({ data: { user: sanitizeUser(user) } });
  },
};
