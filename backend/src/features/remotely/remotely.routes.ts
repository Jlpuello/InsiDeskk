import { Router } from 'express';
import { RemotelyController } from './controllers/remotely.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';
import { requirePermission } from '../../shared/security/permissions.js';

export const remotelyRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.
remotelyRoutes.use(authorize('admin', 'tecnico'));

remotelyRoutes.get('/devices', asyncHandler(RemotelyController.listDevices));
remotelyRoutes.get('/groups', asyncHandler(RemotelyController.listGroups));
// Solo admin, más restrictivo que el resto del router (admin+tecnico) — mismo
// criterio que la gestión de empresas.
remotelyRoutes.get('/agent-script/:companyId', authorize('admin'), asyncHandler(RemotelyController.agentScript));

// `devices:remote-connect` cubre conectar + los 3 escaneos + su historial;
// `devices:remote-script` es aparte y más restrictivo — ejecuta código
// arbitrario en el equipo, no un script fijo de diagnóstico como los scans.
const remoteConnect = requirePermission('devices:remote-connect');
remotelyRoutes.post('/connect/:id', remoteConnect, asyncHandler(RemotelyController.connect));
remotelyRoutes.post('/attended-connect', remoteConnect, asyncHandler(RemotelyController.attendedConnect));
remotelyRoutes.post('/execute-script', requirePermission('devices:remote-script'), asyncHandler(RemotelyController.executeScript));
remotelyRoutes.post('/hardware-scan/:id', remoteConnect, asyncHandler(RemotelyController.hardwareScan));
remotelyRoutes.post('/network-scan/:id', remoteConnect, asyncHandler(RemotelyController.networkScan));
remotelyRoutes.post('/software-scan/:id', remoteConnect, asyncHandler(RemotelyController.softwareScan));
remotelyRoutes.get('/sessions/:id', remoteConnect, asyncHandler(RemotelyController.sessionHistory));
remotelyRoutes.get('/scripts/:id', remoteConnect, asyncHandler(RemotelyController.scriptHistory));
