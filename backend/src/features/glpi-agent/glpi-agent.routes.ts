import { Router } from 'express';
import { GlpiAgentPublicController } from './controllers/glpi-agent-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

// Router SIN verifyJWT — mismo patrón que remotely-public.routes.ts (montado
// bajo /api/public/glpi-agent en app.ts). Un único POST atiende los dos pasos
// del protocolo (contact/inventory, distinguidos por `action` en el body) —
// así es como el agente real arma su `--server`, apuntando a una sola URL.
export const glpiAgentRoutes = Router();

glpiAgentRoutes.post('/', asyncHandler(GlpiAgentPublicController.handle));
