import { Router } from 'express';
import { OrganizationPublicController } from './controllers/organization-public.controller.js';
import { asyncHandler } from '../../shared/utils/async-handler.js';

export const settingsPublicRoutes = Router();

settingsPublicRoutes.get('/organization', asyncHandler(OrganizationPublicController.get));
