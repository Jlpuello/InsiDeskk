import { Router } from 'express';
import { CompanyController } from './controllers/company.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const companyRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts. GET queda para cualquier rol
// autenticado (alimenta selects de empresa en otras pantallas) — el propio
// CompanyService filtra por empresa para cliente/tecnico (ver
// shared/security/tenant-scope.ts), admin ve todas. Las mutaciones son solo
// admin.
companyRoutes.get('/', asyncHandler(CompanyController.list));
companyRoutes.get('/:id', asyncHandler(CompanyController.getById));
companyRoutes.post('/', authorize('admin'), asyncHandler(CompanyController.create));
companyRoutes.put('/:id', authorize('admin'), asyncHandler(CompanyController.update));
companyRoutes.post('/:id/deactivate', authorize('admin'), asyncHandler(CompanyController.deactivate));
