import { Router } from 'express';
import { RemotelyPublicController } from './controllers/remotely-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Router SIN verifyJWT — mismo patrón que publicTicketRoutes/publicQuoteRoutes
// (montado bajo /api/public/remotely en app.ts), separado de
// remotely.routes.ts para que el límite de "esto es público" sea obvio con
// solo mirar qué router importa cada ruta.
export const remotelyPublicRoutes = Router();

remotelyPublicRoutes.post('/harden-report', asyncHandler(RemotelyPublicController.hardenReport));
remotelyPublicRoutes.get('/portable-download', asyncHandler(RemotelyPublicController.portableDownload));
