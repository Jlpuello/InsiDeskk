import { Router } from 'express';
import { PublicTicketController } from './controllers/public-ticket.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Sin verifyJWT — pensado para compartir como link a alguien sin cuenta en
// el sistema (ver app.ts, donde se monta con publicTicketLimiter en vez del
// verifyJWT que llevan el resto de las rutas de tickets).
export const publicTicketRoutes = Router();

publicTicketRoutes.get('/categories', asyncHandler(PublicTicketController.listCategories));
publicTicketRoutes.get('/verify-company', asyncHandler(PublicTicketController.verifyCompany));
publicTicketRoutes.post('/', asyncHandler(PublicTicketController.create));
