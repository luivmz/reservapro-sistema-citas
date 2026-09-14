import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase, initializeDatabase } from '../../src/database/database.js';

const databases = [];
const now = '2026-09-14T12:00:00.000Z';

function setup() {
  const db = createDatabase(':memory:');
  databases.push(db);
  initializeDatabase(db);
  return db;
}

function insertTenant(db, id, slug) {
  db.prepare(`
    INSERT INTO tenants (id, name, slug, timezone, active, created_at, updated_at)
    VALUES (?, ?, ?, 'America/Lima', 1, ?, ?)
  `).run(id, `Tenant ${slug}`, slug, now, now);
}

function insertUser(db, { id, tenantId, email, role = 'ADMIN' }) {
  db.prepare(`
    INSERT INTO users (
      id, tenant_id, name, email, password_hash, role, active, created_at, updated_at
    ) VALUES (?, ?, 'Usuario de prueba', ?, ?, ?, 1, ?, ?)
  `).run(id, tenantId, email, '$2b$12$hash-de-prueba-suficientemente-largo', role, now, now);
}

function insertEmployee(db, id, tenantId) {
  db.prepare(`
    INSERT INTO employees (id, tenant_id, name, active, created_at, updated_at)
    VALUES (?, ?, 'Profesional', 1, ?, ?)
  `).run(id, tenantId, now, now);
}

function insertService(db, id, tenantId, name = 'Consulta') {
  db.prepare(`
    INSERT INTO services (
      id, tenant_id, name, description, duration_minutes, price_cents, active, created_at, updated_at
    ) VALUES (?, ?, ?, '', 60, 10000, 1, ?, ?)
  `).run(id, tenantId, name, now, now);
}

afterEach(() => {
  while (databases.length) {
    databases.pop().close();
  }
});

describe('esquema SQLite multi-tenant', () => {
  test('activa foreign keys y crea las ocho tablas de dominio de forma idempotente', () => {
    const db = setup();
    initializeDatabase(db);

    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    const names = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map(({ name }) => name);

    assert.deepEqual(names, [
      'appointments',
      'clients',
      'employee_schedules',
      'employee_services',
      'employees',
      'services',
      'tenants',
      'users',
    ]);
  });

  test('rechaza una asociación empleado-servicio entre tenants', () => {
    const db = setup();
    insertTenant(db, 'tenant-a', 'tenant-a');
    insertTenant(db, 'tenant-b', 'tenant-b');
    insertEmployee(db, 'employee-a', 'tenant-a');
    insertService(db, 'service-b', 'tenant-b');

    assert.throws(() => {
      db.prepare(`
        INSERT INTO employee_services (tenant_id, employee_id, service_id, created_at)
        VALUES ('tenant-a', 'employee-a', 'service-b', ?)
      `).run(now);
    }, /FOREIGN KEY constraint failed/);
  });

  test('rechaza vínculos de cuenta cross-tenant', () => {
    const db = setup();
    insertTenant(db, 'tenant-a', 'tenant-a');
    insertTenant(db, 'tenant-b', 'tenant-b');
    insertUser(db, { id: 'user-b', tenantId: 'tenant-b', email: 'b@example.com', role: 'PROFESSIONAL' });

    assert.throws(() => {
      db.prepare(`
        INSERT INTO employees (id, tenant_id, user_id, name, active, created_at, updated_at)
        VALUES ('employee-a', 'tenant-a', 'user-b', 'Profesional A', 1, ?, ?)
      `).run(now, now);
    }, /FOREIGN KEY constraint failed/);
  });

  test('aplica constraints de duración, precio, horarios y estados', () => {
    const db = setup();
    insertTenant(db, 'tenant-a', 'tenant-a');
    insertUser(db, { id: 'user-a', tenantId: 'tenant-a', email: 'a@example.com' });
    insertEmployee(db, 'employee-a', 'tenant-a');

    assert.throws(() => {
      db.prepare(`
        INSERT INTO services (
          id, tenant_id, name, duration_minutes, price_cents, active, created_at, updated_at
        ) VALUES ('bad-duration', 'tenant-a', 'Duración inválida', 0, 0, 1, ?, ?)
      `).run(now, now);
    }, /CHECK constraint failed/);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO services (
          id, tenant_id, name, duration_minutes, price_cents, active, created_at, updated_at
        ) VALUES ('bad-price', 'tenant-a', 'Precio inválido', 60, -1, 1, ?, ?)
      `).run(now, now);
    }, /CHECK constraint failed/);

    assert.throws(() => {
      db.prepare(`
        INSERT INTO employee_schedules (
          id, tenant_id, employee_id, day_of_week, start_time, end_time, created_at, updated_at
        ) VALUES ('schedule-bad', 'tenant-a', 'employee-a', 1, '17:00', '09:00', ?, ?)
      `).run(now, now);
    }, /CHECK constraint failed/);

    db.prepare(`
      INSERT INTO clients (id, tenant_id, name, active, created_at, updated_at)
      VALUES ('client-a', 'tenant-a', 'Cliente A', 1, ?, ?)
    `).run(now, now);
    insertService(db, 'service-a', 'tenant-a', 'Servicio válido');

    assert.throws(() => {
      db.prepare(`
        INSERT INTO appointments (
          id, tenant_id, client_id, employee_id, service_id,
          start_at, end_at, status, created_by, created_at, updated_at
        ) VALUES (
          'appointment-a', 'tenant-a', 'client-a', 'employee-a', 'service-a',
          '2026-09-14T15:00:00.000Z', '2026-09-14T16:00:00.000Z', 'UNKNOWN',
          'user-a', ?, ?
        )
      `).run(now, now);
    }, /CHECK constraint failed/);
  });

  test('impide emails duplicados dentro de un tenant y los permite entre tenants', () => {
    const db = setup();
    insertTenant(db, 'tenant-a', 'tenant-a');
    insertTenant(db, 'tenant-b', 'tenant-b');
    insertUser(db, { id: 'user-a', tenantId: 'tenant-a', email: 'same@example.com' });

    assert.throws(
      () => insertUser(db, { id: 'user-a2', tenantId: 'tenant-a', email: 'SAME@example.com' }),
      /UNIQUE constraint failed/,
    );
    assert.doesNotThrow(
      () => insertUser(db, { id: 'user-b', tenantId: 'tenant-b', email: 'same@example.com' }),
    );
  });
});
