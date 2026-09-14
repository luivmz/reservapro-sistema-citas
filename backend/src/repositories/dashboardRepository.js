export function createDashboardRepository(db) {
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) AS total
    FROM appointments
    WHERE tenant_id = @tenantId
      AND (@employeeId IS NULL OR employee_id = @employeeId)
    GROUP BY status
  `);
  const todayCount = db.prepare(`
    SELECT COUNT(*) AS total
    FROM appointments
    WHERE tenant_id = @tenantId
      AND (@employeeId IS NULL OR employee_id = @employeeId)
      AND start_at >= @dayStart AND start_at < @dayEnd
      AND status <> 'CANCELLED'
  `);
  const topServices = db.prepare(`
    SELECT s.id, s.name, COUNT(*) AS appointment_count
    FROM appointments a
    JOIN services s ON s.tenant_id = a.tenant_id AND s.id = a.service_id
    WHERE a.tenant_id = @tenantId
      AND (@employeeId IS NULL OR a.employee_id = @employeeId)
      AND a.status <> 'CANCELLED'
    GROUP BY s.id, s.name
    ORDER BY appointment_count DESC, s.name COLLATE NOCASE
    LIMIT 5
  `);
  const frequentClients = db.prepare(`
    SELECT c.id, c.name, COUNT(*) AS appointment_count
    FROM appointments a
    JOIN clients c ON c.tenant_id = a.tenant_id AND c.id = a.client_id
    WHERE a.tenant_id = @tenantId
      AND (@employeeId IS NULL OR a.employee_id = @employeeId)
      AND a.status <> 'CANCELLED'
    GROUP BY c.id, c.name
    ORDER BY appointment_count DESC, c.name COLLATE NOCASE
    LIMIT 5
  `);

  return {
    metrics(tenantId, employeeId, dayStart, dayEnd) {
      const params = { tenantId, employeeId, dayStart, dayEnd };
      return {
        statusCounts: statusCounts.all(params),
        today: todayCount.get(params).total,
        topServices: topServices.all(params).map((row) => ({
          id: row.id,
          name: row.name,
          appointmentCount: row.appointment_count,
        })),
        frequentClients: frequentClients.all(params).map((row) => ({
          id: row.id,
          name: row.name,
          appointmentCount: row.appointment_count,
        })),
      };
    },
  };
}
