import { mapService } from './serviceRepository.js';

export function createEmployeeServiceRepository(db) {
  const list = db.prepare(`
    SELECT s.*
    FROM employee_services es
    JOIN services s ON s.tenant_id = es.tenant_id AND s.id = es.service_id
    WHERE es.tenant_id = ? AND es.employee_id = ?
    ORDER BY s.name COLLATE NOCASE
  `);
  const offers = db.prepare(`
    SELECT 1 AS found
    FROM employee_services
    WHERE tenant_id = ? AND employee_id = ? AND service_id = ?
  `);
  const removeAll = db.prepare(`
    DELETE FROM employee_services WHERE tenant_id = ? AND employee_id = ?
  `);
  const insert = db.prepare(`
    INSERT INTO employee_services (tenant_id, employee_id, service_id, created_at)
    VALUES (?, ?, ?, ?)
  `);
  const replaceTransaction = db.transaction((tenantId, employeeId, serviceIds, now) => {
    removeAll.run(tenantId, employeeId);
    for (const serviceId of serviceIds) insert.run(tenantId, employeeId, serviceId, now);
  });

  return {
    list(tenantId, employeeId) {
      return list.all(tenantId, employeeId).map(mapService);
    },
    offers(tenantId, employeeId, serviceId) {
      return Boolean(offers.get(tenantId, employeeId, serviceId));
    },
    replace(tenantId, employeeId, serviceIds) {
      replaceTransaction(tenantId, employeeId, serviceIds, new Date().toISOString());
      return this.list(tenantId, employeeId);
    },
  };
}
