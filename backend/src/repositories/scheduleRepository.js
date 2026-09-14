function mapSchedule(row) {
  if (!row) return null;
  return {
    id: row.id,
    employeeId: row.employee_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createScheduleRepository(db) {
  const byId = db.prepare(`
    SELECT * FROM employee_schedules
    WHERE id = ? AND employee_id = ? AND tenant_id = ?
  `);
  const list = db.prepare(`
    SELECT * FROM employee_schedules
    WHERE employee_id = ? AND tenant_id = ?
    ORDER BY day_of_week, start_time
  `);
  const insert = db.prepare(`
    INSERT INTO employee_schedules (
      id, tenant_id, employee_id, day_of_week, start_time, end_time, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @employeeId, @dayOfWeek, @startTime, @endTime, @createdAt, @updatedAt
    )
  `);
  const update = db.prepare(`
    UPDATE employee_schedules
    SET day_of_week = @dayOfWeek, start_time = @startTime,
        end_time = @endTime, updated_at = @updatedAt
    WHERE id = @id AND employee_id = @employeeId AND tenant_id = @tenantId
  `);
  const remove = db.prepare(`
    DELETE FROM employee_schedules
    WHERE id = ? AND employee_id = ? AND tenant_id = ?
  `);
  const overlapping = db.prepare(`
    SELECT * FROM employee_schedules
    WHERE tenant_id = @tenantId AND employee_id = @employeeId
      AND day_of_week = @dayOfWeek
      AND start_time < @endTime AND end_time > @startTime
      AND (@excludeId IS NULL OR id <> @excludeId)
    LIMIT 1
  `);

  return {
    findById(tenantId, employeeId, id) {
      return mapSchedule(byId.get(id, employeeId, tenantId));
    },
    list(tenantId, employeeId) {
      return list.all(employeeId, tenantId).map(mapSchedule);
    },
    findOverlap(tenantId, employeeId, values, excludeId = null) {
      return mapSchedule(overlapping.get({ tenantId, employeeId, ...values, excludeId }));
    },
    create(schedule) {
      insert.run(schedule);
      return this.findById(schedule.tenantId, schedule.employeeId, schedule.id);
    },
    update(tenantId, employeeId, id, changes) {
      const result = update.run({ tenantId, employeeId, id, ...changes });
      return result.changes ? this.findById(tenantId, employeeId, id) : null;
    },
    remove(tenantId, employeeId, id) {
      return remove.run(id, employeeId, tenantId).changes > 0;
    },
  };
}
