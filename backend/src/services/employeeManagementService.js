import { randomUUID } from 'node:crypto';
import { AppError } from '../errors/AppError.js';
import {
  booleanValue,
  email,
  optionalString,
  requiredString,
  uuid,
} from '../utils/validation.js';
import { listFilters, paginated } from './resourceHelpers.js';

export function createEmployeeManagementService({ employeeRepository, userRepository }) {
  function assertProfessionalUser(tenantId, userId) {
    if (!userId) return null;
    const user = userRepository.findRawById(tenantId, userId);
    if (!user || user.role !== 'PROFESSIONAL') {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario PROFESSIONAL no encontrado.');
    }
    return userId;
  }

  function ownEmployee(auth) {
    const employee = employeeRepository.findByUserId(auth.tenantId, auth.userId);
    if (!employee) throw new AppError(403, 'EMPLOYEE_PROFILE_REQUIRED', 'La cuenta no tiene un perfil profesional vinculado.');
    return employee;
  }

  return {
    list(auth, query) {
      if (auth.role === 'PROFESSIONAL') {
        const employee = ownEmployee(auth);
        return { data: [employee], meta: { page: 1, limit: 1, total: 1 } };
      }
      const filters = listFilters(query, { forceActive: auth.role === 'CLIENT' });
      return paginated(employeeRepository.list(auth.tenantId, filters), filters);
    },
    get(auth, idValue) {
      const id = uuid(idValue);
      if (auth.role === 'PROFESSIONAL' && ownEmployee(auth).id !== id) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      }
      const employee = employeeRepository.findById(auth.tenantId, id);
      if (!employee || (auth.role === 'CLIENT' && !employee.active)) {
        throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      }
      return employee;
    },
    create(auth, input) {
      const now = new Date().toISOString();
      const userId = input.userId == null ? null : assertProfessionalUser(auth.tenantId, uuid(input.userId, 'userId'));
      return employeeRepository.create({
        id: randomUUID(),
        tenantId: auth.tenantId,
        userId,
        name: requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: email(input.email, 'email', { optional: true }),
        phone: optionalString(input.phone, 'phone', { max: 30, emptyAsNull: true }),
        active: booleanValue(input.active, 'active', true),
        createdAt: now,
        updatedAt: now,
      });
    },
    update(auth, idValue, input) {
      const id = uuid(idValue);
      const current = employeeRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      const userId = input.userId === undefined
        ? current.userId
        : input.userId === null
          ? null
          : assertProfessionalUser(auth.tenantId, uuid(input.userId, 'userId'));
      return employeeRepository.update(auth.tenantId, id, {
        userId,
        name: input.name === undefined ? current.name : requiredString(input.name, 'name', { min: 2, max: 120 }),
        email: input.email === undefined ? current.email : email(input.email, 'email', { optional: true }),
        phone: input.phone === undefined ? current.phone : optionalString(input.phone, 'phone', { max: 30, emptyAsNull: true }),
        active: input.active === undefined ? current.active : booleanValue(input.active, 'active'),
        updatedAt: new Date().toISOString(),
      });
    },
    deactivate(auth, idValue) {
      const id = uuid(idValue);
      const current = employeeRepository.findById(auth.tenantId, id);
      if (!current) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
      employeeRepository.update(auth.tenantId, id, { ...current, active: false, updatedAt: new Date().toISOString() });
    },
    ownEmployee,
  };
}
