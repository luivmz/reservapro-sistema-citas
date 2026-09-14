import { Router } from 'express';
import { createAvailabilityController } from '../controllers/availabilityController.js';
import { authorize } from '../middleware/authorize.js';

export function createAvailabilityRouter({ availabilityService, authenticate }) {
  const router = Router();
  const controller = createAvailabilityController(availabilityService);
  router.get('/', authenticate, authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), controller.get);
  return router;
}
