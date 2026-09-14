import { AppError } from '../errors/AppError.js';
import { dayjs } from '../utils/dateTime.js';
import { APPOINTMENT_STATUSES } from '../utils/validation.js';

export function createDashboardService({ dashboardRepository, employeeRepository }) {
  return {
    get(auth) {
      let employeeId = null;
      if (auth.role === 'PROFESSIONAL') {
        const employee = employeeRepository.findByUserId(auth.tenantId, auth.userId);
        if (!employee) throw new AppError(403, 'EMPLOYEE_PROFILE_REQUIRED', 'Falta perfil profesional.');
        employeeId = employee.id;
      }

      const localStart = dayjs().tz(auth.timezone).startOf('day');
      const metrics = dashboardRepository.metrics(
        auth.tenantId,
        employeeId,
        localStart.utc().toISOString(),
        localStart.add(1, 'day').utc().toISOString(),
      );
      const counts = Object.fromEntries(APPOINTMENT_STATUSES.map((status) => [status, 0]));
      for (const row of metrics.statusCounts) counts[row.status] = row.total;

      return {
        scope: employeeId ? 'PROFESSIONAL' : 'TENANT',
        timezone: auth.timezone,
        counts: {
          scheduled: counts.SCHEDULED,
          confirmed: counts.CONFIRMED,
          completed: counts.COMPLETED,
          cancelled: counts.CANCELLED,
          noShow: counts.NO_SHOW,
          today: metrics.today,
        },
        topServices: metrics.topServices,
        frequentClients: metrics.frequentClients,
      };
    },
  };
}
