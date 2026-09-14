import { AppError } from '../errors/AppError.js';
import { uuid, uuidArray } from '../utils/validation.js';

export function createEmployeeOfferingService({ employeeRepository, serviceRepository, employeeServiceRepository }) {
  function requireEmployee(tenantId, employeeId) {
    const employee = employeeRepository.findById(tenantId, employeeId);
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Empleado no encontrado.');
    return employee;
  }

  return {
    list(auth, employeeIdValue) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      requireEmployee(auth.tenantId, employeeId);
      return employeeServiceRepository.list(auth.tenantId, employeeId);
    },
    replace(auth, employeeIdValue, input) {
      const employeeId = uuid(employeeIdValue, 'employeeId');
      requireEmployee(auth.tenantId, employeeId);
      const serviceIds = uuidArray(input.serviceIds, 'serviceIds');
      for (const serviceId of serviceIds) {
        const service = serviceRepository.findById(auth.tenantId, serviceId);
        if (!service) throw new AppError(404, 'SERVICE_NOT_FOUND', 'Servicio no encontrado.');
      }
      return employeeServiceRepository.replace(auth.tenantId, employeeId, serviceIds);
    },
  };
}
