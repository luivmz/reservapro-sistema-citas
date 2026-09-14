function mapEmployee(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createEmployeeRepository(db) {
  const insert = db.prepare(`
    INSERT INTO employees (
      id, tenant_id, user_id, name, email, phone, active, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @userId, @name, @email, @phone, @active, @createdAt, @updatedAt
    )
  `);
  const byId = db.prepare('SELECT * FROM employees WHERE id = ? AND tenant_id = ?');
  const byUser = db.prepare('SELECT * FROM employees WHERE user_id = ? AND tenant_id = ?');
  const list = db.prepare(`
    SELECT * FROM employees
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR COALESCE(email, '') LIKE @pattern ESCAPE '\\'
        OR COALESCE(phone, '') LIKE @pattern ESCAPE '\\')
    ORDER BY name COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `);
  const count = db.prepare(`
    SELECT COUNT(*) AS total FROM employees
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR COALESCE(email, '') LIKE @pattern ESCAPE '\\'
        OR COALESCE(phone, '') LIKE @pattern ESCAPE '\\')
  `);
  const update = db.prepare(`
    UPDATE employees
    SET user_id = @userId, name = @name, email = @email, phone = @phone,
        active = @active, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);

  return {
    create(employee) {
      insert.run({ ...employee, active: employee.active ? 1 : 0 });
      return this.findById(employee.tenantId, employee.id);
    },
    findById(tenantId, id) {
      return mapEmployee(byId.get(id, tenantId));
    },
    findByUserId(tenantId, userId) {
      return mapEmployee(byUser.get(userId, tenantId));
    },
    list(tenantId, filters) {
      const params = { ...filters, tenantId, active: filters.active === null ? null : filters.active ? 1 : 0 };
      return {
        items: list.all(params).map(mapEmployee),
        total: count.get(params).total,
      };
    },
    update(tenantId, id, changes) {
      const result = update.run({ ...changes, tenantId, id, active: changes.active ? 1 : 0 });
      return result.changes ? this.findById(tenantId, id) : null;
    },
  };
}
