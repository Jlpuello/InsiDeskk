import { Router } from 'express';
import { DocumentationTemplateController } from './controllers/documentation-template.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const documentationTemplateRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.
// GET abierto a cualquier rol autenticado (un técnico necesita elegir una
// plantilla al cerrar/pausar/completar, no solo un admin) — a diferencia de
// settings.routes.ts, acá no hay un authorize('admin') a nivel de router.
documentationTemplateRoutes.get('/', asyncHandler(DocumentationTemplateController.list));
documentationTemplateRoutes.post('/', authorize('admin'), asyncHandler(DocumentationTemplateController.create));
documentationTemplateRoutes.put('/:id', authorize('admin'), asyncHandler(DocumentationTemplateController.update));
