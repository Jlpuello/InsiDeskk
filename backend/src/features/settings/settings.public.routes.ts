import { Router } from 'express';
import { OrganizationPublicController } from './controllers/organization-public.controller.js';
import { SeoPublicController } from './controllers/seo-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

export const settingsPublicRoutes = Router();

settingsPublicRoutes.get('/organization', asyncHandler(OrganizationPublicController.get));
settingsPublicRoutes.get('/seo', asyncHandler(SeoPublicController.get));
