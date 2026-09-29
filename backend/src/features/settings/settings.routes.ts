import { Router } from 'express';
import { PlatformSettingsController } from './controllers/platform-settings.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { authorize } from '../../shared/middleware/authMiddleware.js';

export const settingsRoutes = Router();

// verifyJWT ya se aplica centralmente en app.ts al montar esta ruta.
settingsRoutes.use(authorize('admin'));

settingsRoutes.get('/remotely', asyncHandler(PlatformSettingsController.getRemotely));
settingsRoutes.put('/remotely', asyncHandler(PlatformSettingsController.updateRemotely));

settingsRoutes.get('/whatsapp', asyncHandler(PlatformSettingsController.getWhatsapp));
settingsRoutes.put('/whatsapp', asyncHandler(PlatformSettingsController.updateWhatsapp));

settingsRoutes.get('/ai', asyncHandler(PlatformSettingsController.getAi));
settingsRoutes.put('/ai', asyncHandler(PlatformSettingsController.updateAi));

settingsRoutes.get('/default-company', asyncHandler(PlatformSettingsController.getDefaultCompany));
settingsRoutes.put('/default-company', asyncHandler(PlatformSettingsController.updateDefaultCompany));

settingsRoutes.get('/email', asyncHandler(PlatformSettingsController.getEmail));
settingsRoutes.put('/email', asyncHandler(PlatformSettingsController.updateEmail));

settingsRoutes.get('/organization', asyncHandler(PlatformSettingsController.getOrganization));
settingsRoutes.put('/organization', asyncHandler(PlatformSettingsController.updateOrganization));

settingsRoutes.get('/seo', asyncHandler(PlatformSettingsController.getSeo));
settingsRoutes.put('/seo', asyncHandler(PlatformSettingsController.updateSeo));
