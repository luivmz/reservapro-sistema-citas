import { Router } from 'express';
import { createServiceController } from '../controllers/serviceController.js';
import { authorize } from '../middleware/authorize.js';

export function createServiceRouter({ catalogService, authenticate }) {
  const router = Router();
  const controller = createServiceController(catalogService);
  router.use(authenticate);
  router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), controller.list);
  router.post('/', authorize('ADMIN'), controller.create);
  router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), controller.get);
  router.put('/:id', authorize('ADMIN'), controller.update);
  router.delete('/:id', authorize('ADMIN'), controller.deactivate);
  return router;
}
