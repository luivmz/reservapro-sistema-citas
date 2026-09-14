import { Router } from 'express';
import { createDashboardController } from '../controllers/dashboardController.js';
import { authorize } from '../middleware/authorize.js';

export function createDashboardRouter({ dashboardService, authenticate }) {
  const router = Router();
  const controller = createDashboardController(dashboardService);
  router.get('/', authenticate, authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'), controller.get);
  return router;
}
