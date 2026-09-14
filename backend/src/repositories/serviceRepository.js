function mapService(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createServiceRepository(db) {
  const insert = db.prepare(`
    INSERT INTO services (
      id, tenant_id, name, description, duration_minutes, price_cents, active, created_at, updated_at
    ) VALUES (
      @id, @tenantId, @name, @description, @durationMinutes, @priceCents, @active, @createdAt, @updatedAt
    )
  `);
  const byId = db.prepare('SELECT * FROM services WHERE id = ? AND tenant_id = ?');
  const list = db.prepare(`
    SELECT * FROM services
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR description LIKE @pattern ESCAPE '\\')
    ORDER BY name COLLATE NOCASE
    LIMIT @limit OFFSET @offset
  `);
  const count = db.prepare(`
    SELECT COUNT(*) AS total FROM services
    WHERE tenant_id = @tenantId
      AND (@active IS NULL OR active = @active)
      AND (@term = '' OR name LIKE @pattern ESCAPE '\\'
        OR description LIKE @pattern ESCAPE '\\')
  `);
  const update = db.prepare(`
    UPDATE services
    SET name = @name, description = @description, duration_minutes = @durationMinutes,
        price_cents = @priceCents, active = @active, updated_at = @updatedAt
    WHERE id = @id AND tenant_id = @tenantId
  `);

  return {
    create(service) {
      insert.run({ ...service, active: service.active ? 1 : 0 });
      return this.findById(service.tenantId, service.id);
    },
    findById(tenantId, id) {
      return mapService(byId.get(id, tenantId));
    },
    list(tenantId, filters) {
      const params = { ...filters, tenantId, active: filters.active === null ? null : filters.active ? 1 : 0 };
      return {
        items: list.all(params).map(mapService),
        total: count.get(params).total,
      };
    },
    update(tenantId, id, changes) {
      const result = update.run({ ...changes, tenantId, id, active: changes.active ? 1 : 0 });
      return result.changes ? this.findById(tenantId, id) : null;
    },
  };
}

export { mapService };
