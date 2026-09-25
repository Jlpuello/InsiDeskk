import { Router } from 'express';
import { InventoryController } from './controllers/inventory.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/security/permissions.js';

export const inventoryRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta. Todo el
// feature es admin/tecnico únicamente (a diferencia de tickets/devices) — el
// cliente no entra al detalle técnico de su infraestructura, ver el análisis
// de la sesión que definió este alcance. Dentro de ese borde, `inventory:view`
// es la sección completa (admin siempre pasa vía el bypass de hasPermission) —
// un técnico puntual puede tener la sección apagada, ver Usuarios → Permisos.
inventoryRoutes.use(authorize('admin', 'tecnico'), requirePermission('inventory:view'));

// /export debe ir antes de "/:id" — si no, Express matchea "export" como si
// fuera un id. Permiso aparte de `inventory:view`: es un volcado masivo de
// datos sensibles (credenciales de routers/cámaras) de toda la empresa.
inventoryRoutes.get('/export', requirePermission('inventory:export'), asyncHandler(InventoryController.exportExcel));

inventoryRoutes.get('/', asyncHandler(InventoryController.list));
inventoryRoutes.post('/', asyncHandler(InventoryController.create));
inventoryRoutes.get('/:id', asyncHandler(InventoryController.getById));
inventoryRoutes.put('/:id', asyncHandler(InventoryController.update));
inventoryRoutes.delete('/:id', asyncHandler(InventoryController.remove));
