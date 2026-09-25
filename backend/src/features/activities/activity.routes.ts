import { Router } from 'express';
import { ActivityController } from './controllers/activity.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';
import { signatureUpload } from './middleware/signature-upload.middleware.js';
import { completionUpload } from './middleware/completion-upload.middleware.js';

export const activityRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.

// Plantillas recurrentes — antes de "/:id" (si no, Express matchea
// "templates" como si fuera el :id de una actividad). Mutaciones solo
// admin/tecnico, mismo criterio que categorías de tickets.
activityRoutes.get('/templates', asyncHandler(ActivityController.listTemplates));
activityRoutes.post('/templates', authorize('admin', 'tecnico'), asyncHandler(ActivityController.createTemplate));
activityRoutes.put(
  '/templates/:id',
  authorize('admin', 'tecnico'),
  asyncHandler(ActivityController.updateTemplate),
);

activityRoutes.get('/', asyncHandler(ActivityController.list));
activityRoutes.post('/', authorize('admin', 'tecnico'), asyncHandler(ActivityController.create));
activityRoutes.get('/:id', asyncHandler(ActivityController.getById));
activityRoutes.put('/:id', authorize('admin', 'tecnico'), asyncHandler(ActivityController.update));
activityRoutes.patch('/:id/estado', authorize('admin', 'tecnico'), asyncHandler(ActivityController.changeStatus));
// Único camino para completar — exige documentar qué se hizo, con hasta 5
// fotos de evidencia opcionales. Reemplaza a PATCH /:id/estado con
// estado=completada, que ya no lo acepta.
activityRoutes.post(
  '/:id/complete',
  authorize('admin', 'tecnico'),
  completionUpload.array('imagenes', 5),
  asyncHandler(ActivityController.complete),
);
activityRoutes.delete('/:id', authorize('admin', 'tecnico'), asyncHandler(ActivityController.remove));

activityRoutes.get('/:id/followups', asyncHandler(ActivityController.listFollowups));
activityRoutes.post(
  '/:id/followups',
  authorize('admin', 'tecnico'),
  asyncHandler(ActivityController.addFollowup),
);

// Acta de entrega — multipart (firma dibujada como PNG/JPG + resumen).
activityRoutes.post(
  '/:id/acta',
  authorize('admin', 'tecnico'),
  signatureUpload.single('firma'),
  asyncHandler(ActivityController.createActa),
);
activityRoutes.post(
  '/:id/acta/:actaId/send',
  authorize('admin', 'tecnico'),
  asyncHandler(ActivityController.sendActa),
);

// Lectura de archivos — abierta a cualquier rol autenticado, el controller
// hace el chequeo de empresa a mano (mismo dueño de la actividad, o admin).
activityRoutes.get('/:id/acta/signature/:filename', asyncHandler(ActivityController.getSignature));
activityRoutes.get('/:id/acta/pdf', asyncHandler(ActivityController.getActaPdf));
activityRoutes.get('/:id/resultado/attachments/:filename', asyncHandler(ActivityController.getResultadoAttachment));
