export function createTenantRepository(db) {
  const insert = db.prepare(`
    INSERT INTO tenants (id, name, slug, timezone, active, created_at, updated_at)
    VALUES (@id, @name, @slug, @timezone, 1, @createdAt, @updatedAt)
  `);
  const findBySlug = db.prepare('SELECT * FROM tenants WHERE slug = ? COLLATE NOCASE');
  const findActiveById = db.prepare('SELECT * FROM tenants WHERE id = ? AND active = 1');

  return {
    create(tenant) {
      insert.run(tenant);
      return findBySlug.get(tenant.slug);
    },
    findBySlug(slugValue) {
      return findBySlug.get(slugValue);
    },
    findActiveById(id) {
      return findActiveById.get(id);
    },
  };
}
