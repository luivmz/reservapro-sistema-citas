import { Router } from 'express';
import { createClientController } from '../controllers/clientController.js';
import { authorize } from '../middleware/authorize.js';

export function createClientRouter({ clientService, authenticate }) {
  const router = Router();
  const controller = createClientController(clientService);
  router.use(authenticate);
  router.get('/', authorize('ADMIN', 'RECEPTIONIST'), controller.list);
  router.post('/', authorize('ADMIN', 'RECEPTIONIST'), controller.create);
  router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'CLIENT'), controller.get);
  router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), controller.update);
  router.delete('/:id', authorize('ADMIN', 'RECEPTIONIST'), controller.deactivate);
  return router;
}
