import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import {
  booleanValue,
  integer,
  optionalString,
  requiredString,
  uuid,
} from '../utils/validation.js';
import { listFilters, paginated } from './resourceHelpers.js';

export function createCatalogService({ serviceRepository, employeeRepository, employeeServiceRepository }) {
  return {
    list(auth, query) {
      if (auth.role === 'PROFESSIONAL') {
        const employee = employeeRepository.findByUserId(auth.tenantId, auth.userId);
        if (!employee) throw new AppError(403, 'EMPLOYEE_PROFILE_REQUIRED', 'La cuenta no tiene un perfil profesional vinculado.');
        const items = employeeServiceRepository.list(auth.tenantId, employee.id).filter((item) => item.active);
        return { data: items, meta: { page: 1, limit: items.length, total: items.length } };
      }
      const filters = listFilters(query, { forceActive: auth.role === 'CLIENT' });
      return paginated(serviceRepository.list(auth.tenantId, filters), filters);
    },
    get(auth, idValue) {
      const id = uuid(idValue);
      const service = serviceRepository.findById(auth.tenantId, id);
      if (!service || (auth.role === 'CLIENT' && !service.active)) {
        throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
      }
      if (auth.role === 'PROFESSIONAL') {
        const employee = employeeRepository.findByUserId(auth.tenantId, auth.userId);
        if (!employee || !employeeServiceRepository.offers(auth.tenantId, employee.id, id)) {
          throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
        }
      }
      return service;
    },
    create(auth, input) {
      const now = new Date().toISOString();
      return serviceRepository.create({
        id: randomUUID(),
        tenantId: auth.tenantId,
        name: requiredString(input.name, 'name', { min: 2, max: 120 }),
        description: optionalString(input.description, 'description', { max: 1000 }) ?? '',
        durationMinutes: integer(input.durationMinutes, 'durationMinutes', { min: 5, max: 480 }),
        priceCents: integer(input.priceCents, 'priceCents', { min: 0, max: 100000000 }),
        active: booleanValue(input.active, 'active', true),
        createdAt: now,
        updatedAt: now,
      });
    },
    update(auth, idValue, input) {
      const id = uuid(idValue);
      const current = serviceRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
      return serviceRepository.update(auth.tenantId, id, {
        name: input.name === undefined ? current.name : requiredString(input.name, 'name', { min: 2, max: 120 }),
        description: input.description === undefined ? current.description : optionalString(input.description, 'description', { max: 1000 }),
        durationMinutes: input.durationMinutes === undefined
          ? current.durationMinutes
          : integer(input.durationMinutes, 'durationMinutes', { min: 5, max: 480 }),
        priceCents: input.priceCents === undefined
          ? current.priceCents
          : integer(input.priceCents, 'priceCents', { min: 0, max: 100000000 }),
        active: input.active === undefined ? current.active : booleanValue(input.active, 'active'),
        updatedAt: new Date().toISOString(),
      });
    },
    deactivate(auth, idValue) {
      const id = uuid(idValue);
      const current = serviceRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
      serviceRepository.update(auth.tenantId, id, { ...current, active: false, updatedAt: new Date().toISOString() });
    },
  };
}
