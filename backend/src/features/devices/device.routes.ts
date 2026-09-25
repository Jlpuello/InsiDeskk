import { Router } from 'express';
import { DeviceController } from './controllers/device.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const deviceRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.
//
// Lectura abierta a cualquier rol autenticado (cliente incluido — el RBAC de
// Prisma ya lo limita a los dispositivos de su propia empresa) A PROPÓSITO:
// CreateTicketModal usa GET /devices para el selector "¿de qué equipo es
// este ticket?" al reportar, y eso lo usa un cliente. La sección
// "Dispositivos" (lista/detalle completo, escaneos, conexión remota) sí
// queda oculta para cliente — pero en el nav/rutas del frontend (ver
// Sidebar.tsx, StaffRoute en App.tsx), no acá: cerrar esto rompería el
// selector de equipo al reportar un ticket. Mutaciones sí restringidas a
// admin/tecnico: antes de un fix anterior, un cliente autenticado podía
// editar o BORRAR cualquier dispositivo de su empresa sin control de rol.
deviceRoutes.get('/', asyncHandler(DeviceController.list));
deviceRoutes.post('/', authorize('admin', 'tecnico'), asyncHandler(DeviceController.create));
// /stats debe ir antes de /:id — si no, Express matchea "stats" como si fuera un :id.
deviceRoutes.get('/stats', asyncHandler(DeviceController.stats));
deviceRoutes.get('/:id', asyncHandler(DeviceController.getById));
deviceRoutes.get('/:id/status', asyncHandler(DeviceController.getStatus));
deviceRoutes.get('/:id/telemetry', asyncHandler(DeviceController.getTelemetry));
deviceRoutes.put('/:id', authorize('admin', 'tecnico'), asyncHandler(DeviceController.update));
deviceRoutes.delete('/:id', authorize('admin', 'tecnico'), asyncHandler(DeviceController.remove));
