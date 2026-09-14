import { Router } from 'express';
import { createAuthController } from '../controllers/authController.js';

export function createAuthRouter({ authService, authenticate }) {
  const router = Router();
  const controller = createAuthController(authService);

  router.post('/register', controller.register);
  router.post('/login', controller.login);
  router.get('/me', authenticate, controller.me);

  return router;
}
