function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    timezone: row.timezone,
    name: row.name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createUserRepository(db) {
  const insert = db.prepare(`
    INSERT INTO users (
      id, tenant_id, name, email, password_hash, role, active, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @name, @email, @passwordHash, @role, @active, @createdAt, @updatedAt
    )
  `);
  const authByCredentials = db.prepare(`
    SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.timezone
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE t.slug = ? COLLATE NOCASE AND u.email = ? COLLATE NOCASE
      AND t.active = 1 AND u.active = 1
  `);
  const byIdAndTenant = db.prepare(`
    SELECT u.*, t.name AS tenant_name, t.slug AS tenant_slug, t.timezone
    FROM users u
    JOIN tenants t ON t.id = u.tenant_id
    WHERE u.id = ? AND u.tenant_id = ? AND t.active = 1
  `);
  const list = db.prepare(`
    SELECT * FROM users
    WHERE tenant_id = @tenantId
    ORDER BY name COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `);
  const count = db.prepare('SELECT COUNT(*) AS total FROM users WHERE tenant_id = ?');
  const update = db.prepare(`
    UPDATE users
    SET name = @name, email = @email, role = @role, active = @active,
        password_hash = COALESCE(@passwordHash, password_hash), updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);

  return {
    create(user) {
      insert.run({ ...user, active: user.active ? 1 : 0 });
      return this.findById(user.tenantId, user.id);
    },
    findForLogin(tenantSlug, emailValue) {
      return authByCredentials.get(tenantSlug, emailValue) ?? null;
    },
    findById(tenantId, id) {
      return mapUser(byIdAndTenant.get(id, tenantId));
    },
    findRawById(tenantId, id) {
      return byIdAndTenant.get(id, tenantId) ?? null;
    },
    list(tenantId, { limit, offset }) {
      return {
        items: list.all({ tenantId, limit, offset }).map(mapUser),
        total: count.get(tenantId).total,
      };
    },
    update(tenantId, id, changes) {
      const result = update.run({ tenantId, id, ...changes, active: changes.active ? 1 : 0 });
      return result.changes ? this.findById(tenantId, id) : null;
    },
  };
}
