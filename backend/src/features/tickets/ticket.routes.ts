import { Router } from 'express';
import { TicketController } from './controllers/ticket.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';
import { ticketCloseUpload } from './middleware/ticket-upload.middleware.js';

export const ticketRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.

// Categorías/SLA — antes de "/:id" (si no, Express matchea "categories"/"sla"
// como si fueran el :id de un ticket). Lectura para cualquier rol
// autenticado (alimenta selects en el form de crear ticket); mutaciones solo
// admin, mismo criterio que Empresas/Configuración.
ticketRoutes.get('/categories', asyncHandler(TicketController.listCategories));
ticketRoutes.post('/categories', authorize('admin'), asyncHandler(TicketController.createCategory));
ticketRoutes.put('/categories/:id', authorize('admin'), asyncHandler(TicketController.updateCategory));
ticketRoutes.post(
  '/categories/:id/subcategories',
  authorize('admin'),
  asyncHandler(TicketController.createSubcategory),
);
ticketRoutes.put(
  '/categories/:id/subcategories/:subcategoryId',
  authorize('admin'),
  asyncHandler(TicketController.updateSubcategory),
);
ticketRoutes.get('/sla', asyncHandler(TicketController.listSlaPolicies));
ticketRoutes.put(
  '/sla/:prioridad/:criticidad',
  authorize('admin'),
  asyncHandler(TicketController.updateSlaPolicy),
);
// Qué niveles de ticket puede ver cada nivel de técnico al navegar la lista
// general (ver TicketService.getTickets) — mismo criterio de lectura
// abierta / mutación admin-only que Categorías y SLA.
ticketRoutes.get('/nivel-visibilidad', asyncHandler(TicketController.listNivelVisibility));
ticketRoutes.put(
  '/nivel-visibilidad/:nivelTecnico/:nivelTicket',
  authorize('admin'),
  asyncHandler(TicketController.updateNivelVisibility),
);

ticketRoutes.get('/', asyncHandler(TicketController.list));
ticketRoutes.post('/', asyncHandler(TicketController.create));
// /stats y /stats/mine deben ir antes de /:id — si no, Express matchea
// "stats" como si fuera un :id.
ticketRoutes.get('/stats', asyncHandler(TicketController.stats));
ticketRoutes.get('/stats/mine', asyncHandler(TicketController.myOpenCount));
ticketRoutes.get('/:id', asyncHandler(TicketController.getById));
// Asignación, edición de campos y flujo de estados (iniciar/pausar/cerrar)
// son acciones del equipo técnico, no del cliente que reportó el ticket —
// mismo criterio que categorías/SLA (mutaciones restringidas, lectura abierta).
ticketRoutes.put('/:id', authorize('admin', 'tecnico'), asyncHandler(TicketController.update));
ticketRoutes.patch('/:id/estado', authorize('admin', 'tecnico'), asyncHandler(TicketController.changeStatus));
// Cierre con documentación obligatoria (texto + hasta 5 fotos) — reemplaza a
// PATCH /:id/estado con estado=cerrado, que ya no lo acepta.
ticketRoutes.post(
  '/:id/close',
  authorize('admin', 'tecnico'),
  ticketCloseUpload.array('imagenes', 5),
  asyncHandler(TicketController.close),
);
ticketRoutes.delete('/:id', authorize('admin', 'tecnico'), asyncHandler(TicketController.remove));
// Única forma de sacar un ticket de "cerrado" — exige motivo (ver
// TicketService.reopenTicket). Un ticket cerrado no acepta ningún otro
// cambio (PUT/estado/notas) hasta pasar por acá.
ticketRoutes.post('/:id/reopen', authorize('admin', 'tecnico'), asyncHandler(TicketController.reopen));

// Lectura abierta a cualquier rol autenticado — TicketController.getAttachment
// hace el chequeo de empresa a mano (mismo dueño del ticket, o admin).
ticketRoutes.get('/:id/attachments/:filename', asyncHandler(TicketController.getAttachment));

ticketRoutes.get('/:id/notes', asyncHandler(TicketController.listNotes));
ticketRoutes.post('/:id/notes', asyncHandler(TicketController.addNote));
ticketRoutes.delete('/:id/notes/:noteId', asyncHandler(TicketController.removeNote));
