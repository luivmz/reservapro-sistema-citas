function mapClient(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createClientRepository(db) {
  const insert = db.prepare(`
    INSERT INTO clients (
      id, tenant_id, user_id, name, email, phone, notes, active, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @userId, @name, @email, @phone, @notes, @active, @createdAt, @updatedAt
    )
  `);
  const byId = db.prepare('SELECT * FROM clients WHERE id = ? AND tenant_id = ?');
  const byUser = db.prepare('SELECT * FROM clients WHERE user_id = ? AND tenant_id = ?');
  const list = db.prepare(`
    SELECT * FROM clients
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR COALESCE(email, '') LIKE @pattern ESCAPE '\\'
        OR COALESCE(phone, '') LIKE @pattern ESCAPE '\\')
    ORDER BY name COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `);
  const count = db.prepare(`
    SELECT COUNT(*) AS total FROM clients
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR COALESCE(email, '') LIKE @pattern ESCAPE '\\'
        OR COALESCE(phone, '') LIKE @pattern ESCAPE '\\')
  `);
  const update = db.prepare(`
    UPDATE clients
    SET user_id = @userId, name = @name, email = @email, phone = @phone,
        notes = @notes, active = @active, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);

  return {
    create(client) {
      insert.run({ ...client, active: client.active ? 1 : 0 });
      return this.findById(client.tenantId, client.id);
    },
    findById(tenantId, id) {
      return mapClient(byId.get(id, tenantId));
    },
    findByUserId(tenantId, userId) {
      return mapClient(byUser.get(userId, tenantId));
    },
    list(tenantId, filters) {
      const params = { ...filters, tenantId, active: filters.active === null ? null : filters.active ? 1 : 0 };
      return {
        items: list.all(params).map(mapClient),
        total: count.get(params).total,
      };
    },
    update(tenantId, id, changes) {
      const result = update.run({ ...changes, tenantId, id, active: changes.active ? 1 : 0 });
      return result.changes ? this.findById(tenantId, id) : null;
    },
  };
}
