import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createDatabase, initializeDatabase } from '../src/database/database.js';

const steps = [];
let db;
let server;

function futureDate(daysAhead = 14) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysAhead);

  const isoDate = date.toISOString().slice(0, 10);
  const dayOfWeek = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  return { isoDate, dayOfWeek };
}

async function closeServer(instance) {
  if (!instance) return;
  await new Promise((resolve, reject) => {
    instance.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main() {
  process.env.NODE_ENV = 'test';
  db = initializeDatabase(createDatabase(':memory:'));

  const app = createApp({
    db,
    env: {
      frontendOrigin: 'http://localhost:5173',
      jwtSecret: randomBytes(48).toString('hex'),
      jwtExpiresIn: '15m',
      bcryptRounds: 10,
    },
  });

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(path, { method = 'GET', token, body, expected = 200 } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = response.status === 204 ? null : await response.json();

    assert.equal(
      response.status,
      expected,
      `${method} ${path}: se esperaba ${expected}, se recibió ${response.status}. ${JSON.stringify(payload)}`,
    );
    return payload;
  }

  async function step(name, operation) {
    await operation();
    steps.push(name);
    console.log(`✓ ${name}`);
  }

  let admin;
  let client;
  let employee;
  let service;
  let appointment;
  const { isoDate, dayOfWeek } = futureDate();
  const startAt = `${isoDate}T10:00:00-05:00`;

  await step('health y conexión SQLite', async () => {
    const response = await request('/api/health');
    assert.equal(response.data.status, 'ok');
  });

  await step('registro de tenant y ADMIN', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      expected: 201,
      body: {
        organizationName: 'Organización Smoke',
        tenantSlug: 'organizacion-smoke',
        timezone: 'America/Lima',
        adminName: 'Admin Smoke',
        email: 'admin@smoke.test',
        password: 'SmokePass123',
      },
    });
    admin = response.data;
    assert.equal(admin.user.role, 'ADMIN');
  });

  await step('login y usuario actual', async () => {
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: {
        tenantSlug: 'organizacion-smoke',
        email: 'admin@smoke.test',
        password: 'SmokePass123',
      },
    });
    admin.token = login.data.token;
    const me = await request('/api/auth/me', { token: admin.token });
    assert.equal(me.data.tenantSlug, 'organizacion-smoke');
    assert.equal(me.data.role, 'ADMIN');
  });

  await step('alta de cliente, empleado y servicio', async () => {
    client = (await request('/api/clients', {
      method: 'POST', token: admin.token, expected: 201, body: { name: 'Cliente Smoke' },
    })).data;
    employee = (await request('/api/employees', {
      method: 'POST', token: admin.token, expected: 201, body: { name: 'Profesional Smoke' },
    })).data;
    service = (await request('/api/services', {
      method: 'POST',
      token: admin.token,
      expected: 201,
      body: { name: 'Consulta Smoke', durationMinutes: 60, priceCents: 10000 },
    })).data;
  });

  await step('asociación y horario profesional', async () => {
    const offerings = await request(`/api/employees/${employee.id}/services`, {
      method: 'PUT', token: admin.token, body: { serviceIds: [service.id] },
    });
    assert.deepEqual(offerings.data.map(({ id }) => id), [service.id]);
    await request(`/api/employees/${employee.id}/schedules`, {
      method: 'POST',
      token: admin.token,
      expected: 201,
      body: { dayOfWeek, startTime: '08:00', endTime: '18:00' },
    });
  });

  await step('disponibilidad y creación de cita', async () => {
    const availability = await request(
      `/api/availability?employeeId=${employee.id}&serviceId=${service.id}&date=${isoDate}`,
      { token: admin.token },
    );
    assert.ok(availability.data.slots.some((slot) => slot.startAt.endsWith('15:00:00.000Z')));

    appointment = (await request('/api/appointments', {
      method: 'POST',
      token: admin.token,
      expected: 201,
      body: { clientId: client.id, employeeId: employee.id, serviceId: service.id, startAt },
    })).data;
    assert.equal(appointment.status, 'SCHEDULED');
  });

  await step('rechazo de solapamiento', async () => {
    const conflict = await request('/api/appointments', {
      method: 'POST',
      token: admin.token,
      expected: 409,
      body: { clientId: client.id, employeeId: employee.id, serviceId: service.id, startAt },
    });
    assert.equal(conflict.error.code, 'APPOINTMENT_CONFLICT');
  });

  await step('filtros y dashboard tenant-scoped', async () => {
    const appointments = await request(
      `/api/appointments?clientId=${client.id}&employeeId=${employee.id}&serviceId=${service.id}&status=SCHEDULED`,
      { token: admin.token },
    );
    assert.deepEqual(appointments.data.map(({ id }) => id), [appointment.id]);
    const dashboard = await request('/api/dashboard', { token: admin.token });
    assert.equal(dashboard.data.scope, 'TENANT');
    assert.equal(dashboard.data.counts.scheduled, 1);
  });

  await step('denegación RBAC para RECEPTIONIST', async () => {
    await request('/api/users', {
      method: 'POST',
      token: admin.token,
      expected: 201,
      body: {
        name: 'Recepción Smoke',
        email: 'recepcion@smoke.test',
        password: 'ReceptionPass123',
        role: 'RECEPTIONIST',
      },
    });
    const login = await request('/api/auth/login', {
      method: 'POST',
      body: {
        tenantSlug: 'organizacion-smoke',
        email: 'recepcion@smoke.test',
        password: 'ReceptionPass123',
      },
    });
    const denied = await request('/api/services', {
      method: 'POST',
      token: login.data.token,
      expected: 403,
      body: { name: 'Servicio no permitido', durationMinutes: 30, priceCents: 0 },
    });
    assert.equal(denied.error.code, 'FORBIDDEN');
  });

  await step('aislamiento entre Tenant A y Tenant B', async () => {
    const tenantB = await request('/api/auth/register', {
      method: 'POST',
      expected: 201,
      body: {
        organizationName: 'Organización Smoke B',
        tenantSlug: 'organizacion-smoke-b',
        timezone: 'America/Lima',
        adminName: 'Admin Smoke B',
        email: 'admin@smoke.test',
        password: 'SmokePass123',
      },
    });
    const hidden = await request(`/api/clients/${client.id}`, {
      token: tenantB.data.token,
      expected: 404,
    });
    assert.equal(hidden.error.code, 'CLIENT_NOT_FOUND');
  });

  await step('cancelación lógica libera el horario', async () => {
    const cancelled = await request(`/api/appointments/${appointment.id}/cancel`, {
      method: 'PATCH', token: admin.token,
    });
    assert.equal(cancelled.data.status, 'CANCELLED');
    const availability = await request(
      `/api/availability?employeeId=${employee.id}&serviceId=${service.id}&date=${isoDate}`,
      { token: admin.token },
    );
    assert.ok(availability.data.slots.some((slot) => slot.startAt.endsWith('15:00:00.000Z')));
  });

  console.log(`\nSmoke test aprobado: ${steps.length} recorridos HTTP sobre SQLite en memoria.`);
}

try {
  await main();
} catch (error) {
  console.error('\nSmoke test fallido.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeServer(server);
  db?.close();
}
