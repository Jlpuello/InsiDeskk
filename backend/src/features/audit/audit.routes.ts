import { Router } from 'express';
import { AuditController } from './controllers/audit.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const auditRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts. Solo admin — es el registro
// de auditoría de toda la plataforma, no algo que un técnico/cliente deba ver.
auditRoutes.use(authorize('admin'));

// Antes de "/logs" — alimentan los <select> de filtro del frontend.
auditRoutes.get('/logs/acciones', asyncHandler(AuditController.listAcciones));
auditRoutes.get('/logs/tablas', asyncHandler(AuditController.listTablas));
auditRoutes.get('/logs', asyncHandler(AuditController.listLogs));
auditRoutes.get('/failed-logins', asyncHandler(AuditController.listFailedLogins));
