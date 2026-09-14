import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import { dayjs, isoInstant } from '../utils/dateTime.js';
import {
  APPOINTMENT_STATUSES,
  optionalString,
  pagination,
  uuid,
  validationError,
} from '../utils/validation.js';
import { appointmentEnd, assertWithinSchedule } from './schedulingRules.js';

const TRANSITIONS = Object.freeze({
  SCHEDULED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'NO_SHOW', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
});

export function createAppointmentService({
  appointmentRepository,
  clientRepository,
  employeeRepository,
  serviceRepository,
  employeeServiceRepository,
  scheduleRepository,
}) {
  function profiles(auth) {
    return {
      client: auth.role === 'CLIENT'
        ? clientRepository.findByUserId(auth.tenantId, auth.userId)
        : null,
      employee: auth.role === 'PROFESSIONAL'
        ? employeeRepository.findByUserId(auth.tenantId, auth.userId)
        : null,
    };
  }

  function assertScoped(auth, appointment) {
    const own = profiles(auth);
    if (auth.role === 'CLIENT' && (!own.client || appointment.clientId !== own.client.id)) {
      throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Cita no encontrada.');
    }
    if (auth.role === 'PROFESSIONAL' && (!own.employee || appointment.employeeId !== own.employee.id)) {
      throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Cita no encontrada.');
    }
  }

  function requireAppointment(auth, id) {
    const appointment = appointmentRepository.findById(auth.tenantId, id);
    if (!appointment) throw new AppError(404, 'APPOINTMENT_NOT_FOUND', 'Cita no encontrada.');
    assertScoped(auth, appointment);
    return appointment;
  }

  function activeResources(tenantId, clientId, employeeId, serviceId) {
    const client = clientRepository.findById(tenantId, clientId);
    const employee = employeeRepository.findById(tenantId, employeeId);
    const service = serviceRepository.findById(tenantId, serviceId);
    if (!client?.active) throw new AppError(404, 'CLIENT_NOT_FOUND', 'Cliente no encontrado.');
    if (!employee?.active) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
    if (!service?.active) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
    if (!employeeServiceRepository.offers(tenantId, employeeId, serviceId)) {
      throw new AppError(422, 'SERVICE_NOT_OFFERED', 'El empleado no presta el servicio seleccionado.');
    }
    return { client, employee, service };
  }

  function validateSlot(auth, employeeId, service, startAt, excludeId = null) {
    const endAt = appointmentEnd(startAt, service.durationMinutes);
    const schedules = scheduleRepository.list(auth.tenantId, employeeId);
    assertWithinSchedule({ schedules, startAt, endAt, timezone: auth.timezone });
    if (appointmentRepository.findConflict(auth.tenantId, employeeId, startAt, endAt, excludeId)) {
      throw new AppError(409, 'APPOINTMENT_CONFLICT', 'El horario solicitado ya no está disponible.');
    }
    return endAt;
  }

  function contextualClientId(auth, requestedId) {
    if (auth.role !== 'CLIENT') return uuid(requestedId, 'clientId');
    const client = clientRepository.findByUserId(auth.tenantId, auth.userId);
    if (!client) throw new AppError(403, 'CLIENT_PROFILE_REQUIRED', 'La cuenta no tiene un perfil de cliente vinculado.');
    return client.id;
  }

  return {
    list(auth, query) {
      const paging = pagination(query);
      const own = profiles(auth);
      if (auth.role === 'CLIENT' && !own.client) throw new AppError(403, 'CLIENT_PROFILE_REQUIRED', 'Falta perfil de cliente.');
      if (auth.role === 'PROFESSIONAL' && !own.employee) throw new AppError(403, 'EMPLOYEE_PROFILE_REQUIRED', 'Falta perfil profesional.');
      const filters = {
        ...paging,
        clientId: auth.role === 'CLIENT'
          ? own.client.id
          : query.clientId === undefined ? null : uuid(query.clientId, 'clientId'),
        employeeId: auth.role === 'PROFESSIONAL'
          ? own.employee.id
          : query.employeeId === undefined ? null : uuid(query.employeeId, 'employeeId'),
        serviceId: query.serviceId === undefined ? null : uuid(query.serviceId, 'serviceId'),
        status: query.status ?? null,
        fromAt: query.from === undefined ? null : isoInstant(query.from, 'from'),
        toAt: query.to === undefined ? null : isoInstant(query.to, 'to'),
      };
      if (filters.status !== null && !APPOINTMENT_STATUSES.includes(filters.status)) {
        validationError([{ field: 'status', message: 'Estado no permitido.' }]);
      }
      if (filters.fromAt && filters.toAt && filters.fromAt >= filters.toAt) {
        validationError([{ field: 'to', message: 'Debe ser posterior a from.' }]);
      }
      const result = appointmentRepository.list(auth.tenantId, filters);
      return { data: result.items, meta: { page: paging.page, limit: paging.limit, total: result.total } };
    },

    get(auth, idValue) {
      return requireAppointment(auth, uuid(idValue));
    },

    create(auth, input) {
      const clientId = contextualClientId(auth, input.clientId);
      const employeeId = uuid(input.employeeId, 'employeeId');
      const serviceId = uuid(input.serviceId, 'serviceId');
      const startAt = isoInstant(input.startAt);
      if (!dayjs(startAt).isAfter(dayjs())) {
        throw new AppError(422, 'PAST_APPOINTMENT', 'La cita debe comenzar en el futuro.');
      }
      const notes = optionalString(input.notes, 'notes', { max: 2000 }) ?? '';

      return appointmentRepository.immediate(() => {
        const { service } = activeResources(auth.tenantId, clientId, employeeId, serviceId);
        const endAt = validateSlot(auth, employeeId, service, startAt);
        const now = new Date().toISOString();
        return appointmentRepository.create({
          id: randomUUID(),
          tenantId: auth.tenantId,
          clientId,
          employeeId,
          serviceId,
          startAt,
          endAt,
          status: 'SCHEDULED',
          notes,
          createdBy: auth.userId,
          createdAt: now,
          updatedAt: now,
        });
      });
    },

    updateDetails(auth, idValue, input) {
      const id = uuid(idValue);
      requireAppointment(auth, id);
      const notes = optionalString(input.notes, 'notes', { max: 2000 }) ?? '';
      return appointmentRepository.updateDetails(auth.tenantId, id, notes);
    },

    reschedule(auth, idValue, input) {
      const id = uuid(idValue);
      const startAt = isoInstant(input.startAt);
      if (!dayjs(startAt).isAfter(dayjs())) {
        throw new AppError(422, 'PAST_APPOINTMENT', 'La cita debe comenzar en el futuro.');
      }
      return appointmentRepository.immediate(() => {
        const current = requireAppointment(auth, id);
        if (!['SCHEDULED', 'CONFIRMED'].includes(current.status)) {
          throw new AppError(409, 'APPOINTMENT_NOT_RESCHEDULABLE', 'El estado actual no permite reprogramar.');
        }
        const { service } = activeResources(
          auth.tenantId,
          current.clientId,
          current.employeeId,
          current.serviceId,
        );
        const endAt = validateSlot(auth, current.employeeId, service, startAt, id);
        return appointmentRepository.reschedule(auth.tenantId, id, startAt, endAt);
      });
    },

    changeStatus(auth, idValue, nextStatus) {
      const id = uuid(idValue);
      if (!APPOINTMENT_STATUSES.includes(nextStatus)) {
        validationError([{ field: 'status', message: 'Estado no permitido.' }]);
      }
      const current = requireAppointment(auth, id);
      if (!TRANSITIONS[current.status].includes(nextStatus)) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', `No se permite ${current.status} → ${nextStatus}.`);
      }
      return appointmentRepository.updateStatus(auth.tenantId, id, nextStatus);
    },

    cancel(auth, idValue) {
      return this.changeStatus(auth, idValue, 'CANCELLED');
    },
  };
}
