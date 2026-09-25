import { Router } from 'express';
import { AuthController } from './controllers/auth.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authLimiter } from '../../shared/security/rate-limiter.js';

export const authRoutes = Router();

authRoutes.post('/register', authLimiter, asyncHandler(AuthController.register));
authRoutes.post('/login', authLimiter, asyncHandler(AuthController.login));
authRoutes.post('/refresh', authLimiter, asyncHandler(AuthController.refresh));
authRoutes.post('/logout', asyncHandler(AuthController.logout));
