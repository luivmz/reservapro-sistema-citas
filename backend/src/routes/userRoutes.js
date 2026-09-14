import { Router } from 'express';
import { createUserController } from '../controllers/userController.js';
import { authorize } from '../middleware/authorize.js';

export function createUserRouter({ userService, authenticate }) {
  const router = Router();
  const controller = createUserController(userService);

  router.use(authenticate, authorize('ADMIN'));
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.deactivate);

  return router;
}
