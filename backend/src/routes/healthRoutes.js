import { Router } from 'express';
import { createHealthController } from '../controllers/healthController.js';

export function createHealthRouter(db) {
  const router = Router();
  const controller = createHealthController(db);

  router.get('/', controller.getHealth);
  return router;
}
