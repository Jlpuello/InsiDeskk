import { Router } from 'express';
import { UserController } from './controllers/user.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const userRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.

// Lectura abierta a admin/tecnico: alimenta el selector de "Asignar a" en
// tickets (un técnico necesita ver a sus colegas para reasignar, no solo
// verse a sí mismo). Mutaciones (editar rol, desactivar, borrar) siguen
// siendo solo de admin.
userRoutes.get('/', authorize('admin', 'tecnico'), asyncHandler(UserController.list));
userRoutes.post('/', authorize('admin'), asyncHandler(UserController.create));
userRoutes.put('/:id', authorize('admin'), asyncHandler(UserController.update));
userRoutes.delete('/:id', authorize('admin'), asyncHandler(UserController.remove));
userRoutes.post('/:id/reset-2fa', authorize('admin'), asyncHandler(UserController.resetTwoFactor));
