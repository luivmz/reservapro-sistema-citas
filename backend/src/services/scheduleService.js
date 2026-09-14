import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { localTime, uuid, weekday } from '../utils/validation.js';

export function createScheduleService({ scheduleRepository, employeeRepository }) {
  function requireEmployee(auth, employeeId) {
    const employee = employeeRepository.findById(auth.tenantId, employeeId);
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
    if (auth.role === 'PROFESSIONAL' && employee.userId !== auth.userId) {
      throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
    }
    return employee;
  }

  function values(input, current = {}) {
    const dayOfWeek = input.dayOfWeek === undefined ? current.dayOfWeek : weekday(input.dayOfWeek);
    const startTime = input.startTime === undefined ? current.startTime : localTime(input.startTime, 'startTime');
    const endTime = input.endTime === undefined ? current.endTime : localTime(input.endTime, 'endTime');
    if (startTime >= endTime) {
      throw new AppError(422, 'INVALID_SCHEDULE', 'La hora inicial debe ser anterior a la final.');
    }
    return { dayOfWeek, startTime, endTime };
  }

  function assertNoOverlap(auth, employeeId, scheduleValues, excludeId = null) {
    if (scheduleRepository.findOverlap(auth.tenantId, employeeId, scheduleValues, excludeId)) {
      throw new AppError(409, 'SCHEDULE_CONFLICT', 'El bloque se superpone con otro horario del empleado.');
    }
  }

  return {
    list(auth, employeeIdValue) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      requireEmployee(auth, employeeId);
      return scheduleRepository.list(auth.tenantId, employeeId);
    },
    create(auth, employeeIdValue, input) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      requireEmployee(auth, employeeId);
      const scheduleValues = values(input);
      assertNoOverlap(auth, employeeId, scheduleValues);
      const now = new Date().toISOString();
      return scheduleRepository.create({
        id: randomUUID(),
        tenantId: auth.tenantId,
        employeeId,
        ...scheduleValues,
        createdAt: now,
        updatedAt: now,
      });
    },
    update(auth, employeeIdValue, scheduleIdValue, input) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      const scheduleId = uuid(scheduleIdValue, 'scheduleId');
      requireEmployee(auth, employeeId);
      const current = scheduleRepository.findById(auth.tenantId, employeeId, scheduleId);
      if (!current) throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Horario no encontrado.');
      const scheduleValues = values(input, current);
      assertNoOverlap(auth, employeeId, scheduleValues, scheduleId);
      return scheduleRepository.update(auth.tenantId, employeeId, scheduleId, {
        ...scheduleValues,
        updatedAt: new Date().toISOString(),
      });
    },
    remove(auth, employeeIdValue, scheduleIdValue) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      const scheduleId = uuid(scheduleIdValue, 'scheduleId');
      requireEmployee(auth, employeeId);
      if (!scheduleRepository.remove(auth.tenantId, employeeId, scheduleId)) {
        throw new AppError(404, 'SCHEDULE_NOT_FOUND', 'Horario no encontrado.');
      }
    },
  };
}
