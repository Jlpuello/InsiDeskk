import { Router } from 'express';
import { AccountController } from './controllers/account.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Self-service sobre la PROPIA cuenta — a diferencia de features/users
// (admin-only, gestiona cuentas ajenas), acá no hay authorize(...) de rol:
// cualquier usuario autenticado (admin/tecnico/cliente) administra su propia
// seguridad. verifyJWT ya se aplica centralmente al montar esta ruta en app.ts.
export const accountRoutes = Router();

accountRoutes.get('/security', asyncHandler(AccountController.getSecurity));
accountRoutes.post('/password', asyncHandler(AccountController.changePassword));
accountRoutes.post('/2fa/setup', asyncHandler(AccountController.setupTwoFactor));
accountRoutes.post('/2fa/verify', asyncHandler(AccountController.verifyTwoFactor));
accountRoutes.post('/2fa/disable', asyncHandler(AccountController.disableTwoFactor));
accountRoutes.post('/sessions/revoke-others', asyncHandler(AccountController.revokeOtherSessions));
