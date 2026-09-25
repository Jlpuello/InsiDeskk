import { Router } from 'express';
import { QuoteController } from './controllers/quote.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/security/permissions.js';
import { quoteSignatureUpload } from './middleware/quote-signature-upload.middleware.js';
import { quoteDocumentUpload } from './middleware/quote-document-upload.middleware.js';

export const quoteRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.

// `quotes:manage` gobierna la sección Cotizaciones en sí (listar/crear/editar/
// enviar/cancelar) — no afecta `/by-ticket`, que es parte de ver el ticket
// (cualquier staff necesita ver el estado de una cotización ya asociada,
// tenga o no la sección habilitada; ver Usuarios → Permisos).
const manageQuotes = requirePermission('quotes:manage');

// Antes de "/:id" — si no, Express matchea "approvers"/"pending-for-me" como
// si fueran el :id de una cotización.
quoteRoutes.get('/approvers', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.listApprovers));
quoteRoutes.get('/pending-for-me', authorize('cliente'), asyncHandler(QuoteController.listPendingForMe));
quoteRoutes.get('/by-ticket/:ticketId', asyncHandler(QuoteController.listByTicket));

quoteRoutes.get('/', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.list));
quoteRoutes.post('/', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.create));
quoteRoutes.get('/:id', asyncHandler(QuoteController.getById));
quoteRoutes.put('/:id', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.update));
quoteRoutes.delete('/:id', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.remove));

quoteRoutes.post('/:id/send', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.send));
quoteRoutes.post('/:id/cancel', authorize('admin', 'tecnico'), manageQuotes, asyncHandler(QuoteController.cancel));

// Canal autenticado del híbrido — solo el cliente designado como aprobador
// (ver QuoteService.assertCanResolve, chequeado dentro del controller).
quoteRoutes.post(
  '/:id/approve',
  authorize('cliente'),
  quoteSignatureUpload.single('firma'),
  asyncHandler(QuoteController.approve),
);
quoteRoutes.post('/:id/reject', authorize('cliente'), asyncHandler(QuoteController.reject));

// Lectura de archivos — el controller hace el chequeo de empresa a mano.
quoteRoutes.get('/:id/signature/:filename', asyncHandler(QuoteController.getSignature));
quoteRoutes.get('/:id/pdf', asyncHandler(QuoteController.getPdf));

// Documentos de soporte — solo admin/técnico suben o borran; cualquiera de
// la misma empresa (incluido el aprobador) puede descargar.
quoteRoutes.post(
  '/:id/documents',
  authorize('admin', 'tecnico'),
  quoteDocumentUpload.array('documentos', 5),
  asyncHandler(QuoteController.uploadDocuments),
);
quoteRoutes.delete(
  '/:id/documents/:filename',
  authorize('admin', 'tecnico'),
  asyncHandler(QuoteController.removeDocument),
);
quoteRoutes.get('/:id/documents/:filename', asyncHandler(QuoteController.getDocument));
