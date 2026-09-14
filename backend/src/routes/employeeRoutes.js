import { Router } from 'express';
import { createEmployeeController } from '../controllers/employeeController.js';
import { createEmployeeOfferingController } from '../controllers/employeeOfferingController.js';
import { createScheduleController } from '../controllers/scheduleController.js';
import { authorize } from '../middleware/authorize.js';

export function createEmployeeRouter({
  employeeManagementService,
  employeeOfferingService,
  scheduleService,
  authenticate,
}) {
  const router = Router();
  const employees = createEmployeeController(employeeManagementService);
  const offerings = createEmployeeOfferingController(employeeOfferingService);
  const schedules = createScheduleController(scheduleService);

  router.use(authenticate);
  router.get('/', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), employees.list);
  router.post('/', authorize('ADMIN'), employees.create);

  router.get('/:id/services', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), offerings.list);
  router.put('/:id/services', authorize('ADMIN'), offerings.replace);
  router.get('/:id/schedules', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL'), schedules.list);
  router.post('/:id/schedules', authorize('ADMIN'), schedules.create);
  router.put('/:id/schedules/:scheduleId', authorize('ADMIN'), schedules.update);
  router.delete('/:id/schedules/:scheduleId', authorize('ADMIN'), schedules.remove);

  router.get('/:id', authorize('ADMIN', 'RECEPTIONIST', 'PROFESSIONAL', 'CLIENT'), employees.get);
  router.put('/:id', authorize('ADMIN'), employees.update);
  router.delete('/:id', authorize('ADMIN'), employees.deactivate);
  return router;
}
