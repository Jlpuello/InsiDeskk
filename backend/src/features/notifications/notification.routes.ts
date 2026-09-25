import { Router } from 'express';
import { NotificationController } from './controllers/notification.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const notificationRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.
// /test y /jobs/:jobId son utilidades de soporte (disparar/revisar un envío a
// mano) — admin/tecnico únicamente, como siempre. /mine* es la campanita del
// nav: cualquier rol autenticado tiene sus propias notificaciones, incluido
// cliente (ver notification.service.ts#registerNotificationListeners).
notificationRoutes.post('/test', authorize('admin', 'tecnico'), asyncHandler(NotificationController.sendTest));
notificationRoutes.get('/jobs/:jobId', authorize('admin', 'tecnico'), asyncHandler(NotificationController.jobStatus));

notificationRoutes.get('/mine', asyncHandler(NotificationController.listMine));
notificationRoutes.get('/mine/unread-count', asyncHandler(NotificationController.unreadCount));
notificationRoutes.post('/mine/:id/read', asyncHandler(NotificationController.markRead));
notificationRoutes.post('/mine/read-all', asyncHandler(NotificationController.markAllRead));
