import { Router } from 'express';
import { createAppointmentController } from '../controllers/appointmentController.js';
import { authorize } from '../middleware/authorize.js';

export function createAppointmentRouter({ appointmentService, authenticate }) {
  const router = Router();
  const controller = createAppointmentController(appointmentService);
  router.use(authenticate);
  router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), controller.list);
  router.post('/', authorize('ADMIN', 'RECEPTIONIST', 'CLIENT'), controller.create);
  router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), controller.get);
  router.put('/:id', authorize('ADMIN', 'RECEPTIONIST'), controller.update);
  router.patch('/:id/reschedule', authorize('ADMIN', 'RECEPTIONIST', 'CLIENT'), controller.reschedule);
  router.patch('/:id/cancel', authorize('ADMIN', 'RECEPTIONIST', 'CLIENT'), controller.cancel);
  router.patch('/:id/status', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'), controller.changeStatus);
  return router;
}
