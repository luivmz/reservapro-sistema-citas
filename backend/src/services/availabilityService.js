import { AppError } from '../errors/AppError.js';
import { dateOnly, dayjs, localDateTime } from '../utils/dateTime.js';
import { uuid } from '../utils/validation.js';
import { intervalsOverlap, scheduleWindows } from './schedulingRules.js';

export function createAvailabilityService({
  clientRepository,
  employeeRepository,
  serviceRepository,
  employeeServiceRepository,
  scheduleRepository,
  appointmentRepository,
}) {
  return {
    get(auth, query) {
      const employeeId = uuid(query.employeeId, 'employeeId');
      const serviceId = uuid(query.serviceId, 'serviceId');
      const date = dateOnly(query.date);
      const employee = employeeRepository.findById(auth.tenantId, employeeId);
      const service = serviceRepository.findById(auth.tenantId, serviceId);

      if (!employee?.active) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      if (!service?.active) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
      if (auth.role === 'PROFESSIONAL') {
        const own = employeeRepository.findByUserId(auth.tenantId, auth.userId);
        if (!own || own.id !== employeeId) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      }
      if (!employeeServiceRepository.offers(auth.tenantId, employeeId, serviceId)) {
        throw new AppError(422, 'SERVICE_NOT_OFFERED', 'El empleado no presta el servicio seleccionado.');
      }

      const schedules = scheduleRepository.list(auth.tenantId, employeeId);
      const windows = scheduleWindows({ schedules, date, timezone: auth.timezone });
      const dayStart = localDateTime(date, '00:00', auth.timezone).utc();
      const dayEnd = dayStart.add(1, 'day');
      const busy = appointmentRepository.listBlocking(
        auth.tenantId,
        employeeId,
        dayStart.toISOString(),
        dayEnd.toISOString(),
      );
      const now = dayjs();
      const slots = [];

      for (const window of windows) {
        for (let start = window.start; ; start = start.add(15, 'minute')) {
          const end = start.add(service.durationMinutes, 'minute');
          if (end.isAfter(window.end)) break;
          if (start.isBefore(now)) continue;
          const startAt = start.utc().toISOString();
          const endAt = end.utc().toISOString();
          const occupied = busy.some((item) => intervalsOverlap(
            startAt,
            endAt,
            item.start_at,
            item.end_at,
          ));
          if (!occupied) slots.push({ startAt, endAt });
        }
      }

      return {
        date,
        timezone: auth.timezone,
        employeeId,
        serviceId,
        durationMinutes: service.durationMinutes,
        slots,
      };
    },
  };
}
