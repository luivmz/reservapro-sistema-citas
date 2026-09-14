import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase, initializeDatabase } from '../src/database/database.js';

const env = {
  frontendOrigin: 'http://localhost:5173',
  jwtSecret: 'test-secret-with-at-least-32-characters-long',
  jwtExpiresIn: '2h',
  bcryptRounds: 10,
};
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('dashboard tenant-scoped y RBAC', () => {
  let db;
  let app;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    db = initializeDatabase(createDatabase(':memory:'));
    app = createApp({ db, env });
  });
  afterEach(() => db.close());

  async function tenant(slug) {
    const admin = (await request(app).post('/api/auth/register').send({
      organizationName: `Organización ${slug}`,
      tenantSlug: slug,
      adminName: 'Admin',
      email: 'admin@example.com',
      password: 'AdminPass123',
    }).expect(201)).body.data;
    const client = (await request(app).post('/api/clients').set(bearer(admin.token))
      .send({ name: `Cliente ${slug}` }).expect(201)).body.data;
    const employee = (await request(app).post('/api/employees').set(bearer(admin.token))
      .send({ name: `Profesional ${slug}` }).expect(201)).body.data;
    const service = (await request(app).post('/api/services').set(bearer(admin.token)).send({
      name: `Servicio ${slug}`, durationMinutes: 60, priceCents: 10000,
    }).expect(201)).body.data;
    await request(app).put(`/api/employees/${employee.id}/services`).set(bearer(admin.token))
      .send({ serviceIds: [service.id] }).expect(200);
    await request(app).post(`/api/employees/${employee.id}/schedules`).set(bearer(admin.token))
      .send({ dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }).expect(201);
    return { ...admin, client, employee, service };
  }

  async function createAppointment(fixture, time, employeeId = fixture.employee.id) {
    return (await request(app).post('/api/appointments').set(bearer(fixture.token)).send({
      clientId: fixture.client.id,
      employeeId,
      serviceId: fixture.service.id,
      startAt: `2030-01-07T${time}:00-05:00`,
    }).expect(201)).body.data;
  }

  async function user(fixture, role, email) {
    return (await request(app).post('/api/users').set(bearer(fixture.token)).send({
      name: role,
      email,
      password: 'UserPassword123',
      role,
    }).expect(201)).body.data;
  }

  async function login(slug, email) {
    return (await request(app).post('/api/auth/login').send({
      tenantSlug: slug,
      email,
      password: 'UserPassword123',
    }).expect(200)).body.data.token;
  }

  test('calcula estados, servicios y clientes frecuentes sin mezclar tenants', async () => {
    const a = await tenant('tenant-a');
    const b = await tenant('tenant-b');
    const scheduled = await createAppointment(a, '09:00');
    const cancelled = await createAppointment(a, '11:00');
    await request(app).patch(`/api/appointments/${cancelled.id}/cancel`).set(bearer(a.token)).expect(200);
    await createAppointment(b, '09:00');

    const dashboard = await request(app).get('/api/dashboard').set(bearer(a.token)).expect(200);
    assert.equal(dashboard.body.data.scope, 'TENANT');
    assert.equal(dashboard.body.data.counts.scheduled, 1);
    assert.equal(dashboard.body.data.counts.cancelled, 1);
    assert.equal(dashboard.body.data.topServices[0].appointmentCount, 1);
    assert.equal(dashboard.body.data.frequentClients[0].appointmentCount, 1);
    assert.equal(dashboard.body.data.topServices[0].id, a.service.id);
    assert.equal(scheduled.status, 'SCHEDULED');
  });

  test('PROFESSIONAL recibe solo sus métricas y CLIENT no accede', async () => {
    const a = await tenant('tenant-a');
    const professional = await user(a, 'PROFESSIONAL', 'prof@example.com');
    await request(app).put(`/api/employees/${a.employee.id}`).set(bearer(a.token))
      .send({ userId: professional.id }).expect(200);
    await createAppointment(a, '09:00');

    const otherEmployee = (await request(app).post('/api/employees').set(bearer(a.token))
      .send({ name: 'Otro profesional' }).expect(201)).body.data;
    await request(app).put(`/api/employees/${otherEmployee.id}/services`).set(bearer(a.token))
      .send({ serviceIds: [a.service.id] }).expect(200);
    await request(app).post(`/api/employees/${otherEmployee.id}/schedules`).set(bearer(a.token))
      .send({ dayOfWeek: 1, startTime: '08:00', endTime: '18:00' }).expect(201);
    await createAppointment(a, '09:00', otherEmployee.id);

    const professionalToken = await login('tenant-a', professional.email);
    const scoped = await request(app).get('/api/dashboard').set(bearer(professionalToken)).expect(200);
    assert.equal(scoped.body.data.scope, 'PROFESSIONAL');
    assert.equal(scoped.body.data.counts.scheduled, 1);

    const client = await user(a, 'CLIENT', 'client@example.com');
    const clientToken = await login('tenant-a', client.email);
    await request(app).get('/api/dashboard').set(bearer(clientToken)).expect(403);
  });

  test('RECEPTIONIST accede al dashboard operativo pero no administra servicios', async () => {
    const a = await tenant('tenant-a');
    const receptionist = await user(a, 'RECEPTIONIST', 'reception@example.com');
    const token = await login('tenant-a', receptionist.email);

    await request(app).get('/api/dashboard').set(bearer(token)).expect(200);
    await request(app).post('/api/services').set(bearer(token)).send({
      name: 'No permitido', durationMinutes: 60, priceCents: 0,
    }).expect(403);
  });
});
