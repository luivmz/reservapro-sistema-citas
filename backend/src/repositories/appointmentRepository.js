function mapAppointment(row) {
  if (!row) return null;
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    serviceId: row.service_id,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_JOINED = `
  SELECT a.*, c.name AS client_name, e.name AS employee_name,
         s.name AS service_name, s.duration_minutes
  FROM appointments a
  JOIN clients c ON c.tenant_id = a.tenant_id AND c.id = a.client_id
  JOIN employees e ON e.tenant_id = a.tenant_id AND e.id = a.employee_id
  JOIN services s ON s.tenant_id = a.tenant_id AND s.id = a.service_id
`;

export function createAppointmentRepository(db) {
  const byId = db.prepare(`${SELECT_JOINED} WHERE a.id = ? AND a.tenant_id = ?`);
  const insert = db.prepare(`
    INSERT INTO appointments (
      id, tenant_id, client_id, employee_id, service_id, start_at, end_at,
      status, notes, created_by, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @clientId, @employeeId, @serviceId, @startAt, @endAt,
      @status, @notes, @createdBy, @createdAt, @updatedAt
    )
  `);
  const conflict = db.prepare(`
    SELECT id, start_at, end_at, status
    FROM appointments
    WHERE tenant_id = @tenantId AND employee_id = @employeeId
      AND status IN ('SCHEDULED', 'CONFIRMED')
      AND start_at < @endAt AND end_at > @startAt
      AND (@excludeId IS NULL OR id <> @excludeId)
    LIMIT 1
  `);
  const listBlocking = db.prepare(`
    SELECT id, start_at, end_at, status
    FROM appointments
    WHERE tenant_id = @tenantId AND employee_id = @employeeId
      AND status IN ('SCHEDULED', 'CONFIRMED')
      AND start_at < @endAt AND end_at > @startAt
    ORDER BY start_at
  `);
  const list = db.prepare(`${SELECT_JOINED}
    WHERE a.tenant_id = @tenantId
      AND (@clientId IS NULL OR a.client_id = @clientId)
      AND (@employeeId IS NULL OR a.employee_id = @employeeId)
      AND (@serviceId IS NULL OR a.service_id = @serviceId)
      AND (@status IS NULL OR a.status = @status)
      AND (@fromAt IS NULL OR a.end_at > @fromAt)
      AND (@toAt IS NULL OR a.start_at < @toAt)
    ORDER BY a.start_at
    LIMIT @limit OFFSET @offset
  `);
  const count = db.prepare(`
    SELECT COUNT(*) AS total FROM appointments a
    WHERE a.tenant_id = @tenantId
      AND (@clientId IS NULL OR a.client_id = @clientId)
      AND (@employeeId IS NULL OR a.employee_id = @employeeId)
      AND (@serviceId IS NULL OR a.service_id = @serviceId)
      AND (@status IS NULL OR a.status = @status)
      AND (@fromAt IS NULL OR a.end_at > @fromAt)
      AND (@toAt IS NULL OR a.start_at < @toAt)
  `);
  const updateDetails = db.prepare(`
    UPDATE appointments SET notes = @notes, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);
  const reschedule = db.prepare(`
    UPDATE appointments SET start_at = @startAt, end_at = @endAt, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);
  const updateStatus = db.prepare(`
    UPDATE appointments SET status = @status, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);

  return {
    findById(tenantId, id) {
      return mapAppointment(byId.get(id, tenantId));
    },
    findConflict(tenantId, employeeId, startAt, endAt, excludeId = null) {
      return conflict.get({ tenantId, employeeId, startAt, endAt, excludeId }) ?? null;
    },
    listBlocking(tenantId, employeeId, startAt, endAt) {
      return listBlocking.all({ tenantId, employeeId, startAt, endAt });
    },
    create(appointment) {
      insert.run(appointment);
      return this.findById(appointment.tenantId, appointment.id);
    },
    list(tenantId, filters) {
      const params = { ...filters, tenantId };
      return { items: list.all(params).map(mapAppointment), total: count.get(params).total };
    },
    updateDetails(tenantId, id, notes) {
      const result = updateDetails.run({ tenantId, id, notes, updatedAt: new Date().toISOString() });
      return result.changes ? this.findById(tenantId, id) : null;
    },
    reschedule(tenantId, id, startAt, endAt) {
      const result = reschedule.run({ tenantId, id, startAt, endAt, updatedAt: new Date().toISOString() });
      return result.changes ? this.findById(tenantId, id) : null;
    },
    updateStatus(tenantId, id, status) {
      const result = updateStatus.run({ tenantId, id, status, updatedAt: new Date().toISOString() });
      return result.changes ? this.findById(tenantId, id) : null;
    },
    immediate(work, ...args) {
      return db.transaction(work).immediate(...args);
    },
  };
}
