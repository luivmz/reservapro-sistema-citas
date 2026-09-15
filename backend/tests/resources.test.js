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

describe('recursos tenant-scoped, asociaciones y horarios', () => {
  let db;
  let app;
  let adminA;
  let adminB;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    db = initializeDatabase(createDatabase(':memory:'));
    app = createApp({ db, env });
    adminA = (await request(app).post('/api/auth/register').send({
      organizationName: 'Tenant A',
      tenantSlug: 'tenant-a',
      adminName: 'Admin A',
      email: 'admin@example.com',
      password: 'AdminPass123',
    }).expect(201)).body.data;
    adminB = (await request(app).post('/api/auth/register').send({
      organizationName: 'Tenant B',
      tenantSlug: 'tenant-b',
      adminName: 'Admin B',
      email: 'admin@example.com',
      password: 'AdminPass123',
    }).expect(201)).body.data;
  });

  afterEach(() => db.close());

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  async function createClient(token, overrides = {}) {
    return (await request(app).post('/api/clients').set(bearer(token)).send({
      name: 'Cliente Uno',
      email: 'cliente@example.com',
      phone: '+51 999 111 222',
      notes: 'Prefiere horario de mañana',
      ...overrides,
    }).expect(201)).body.data;
  }

  async function createEmployee(token, overrides = {}) {
    return (await request(app).post('/api/employees').set(bearer(token)).send({
      name: 'Profesional Uno',
      email: 'profesional@example.com',
      phone: '+51 999 222 333',
      ...overrides,
    }).expect(201)).body.data;
  }

  async function createService(token, overrides = {}) {
    return (await request(app).post('/api/services').set(bearer(token)).send({
      name: 'Consulta general',
      description: 'Evaluación inicial',
      durationMinutes: 60,
      priceCents: 12000,
      ...overrides,
    }).expect(201)).body.data;
  }

  async function createUser(token, role, email, name = role) {
    return (await request(app).post('/api/users').set(bearer(token)).send({
      name,
      email,
      password: 'UserPassword123',
      role,
    }).expect(201)).body.data;
  }

  async function login(tenantSlug, email) {
    return (await request(app).post('/api/auth/login').send({
      tenantSlug,
      email,
      password: 'UserPassword123',
    }).expect(200)).body.data.token;
  }

  test('completa CRUD de clientes con búsqueda y baja lógica', async () => {
    const client = await createClient(adminA.token);

    const list = await request(app)
      .get('/api/clients?search=Cliente&active=true')
      .set(bearer(adminA.token))
      .expect(200);
    assert.equal(list.body.meta.total, 1);
    assert.equal(list.body.data[0].id, client.id);

    const updated = await request(app)
      .put(`/api/clients/${client.id}`)
      .set(bearer(adminA.token))
      .send({ name: 'Cliente Actualizado' })
      .expect(200);
    assert.equal(updated.body.data.name, 'Cliente Actualizado');
    assert.equal(updated.body.data.email, 'cliente@example.com');

    await request(app)
      .delete(`/api/clients/${client.id}`)
      .set(bearer(adminA.token))
      .expect(204);
    const stored = db.prepare('SELECT active FROM clients WHERE id = ?').get(client.id);
    assert.equal(stored.active, 0);
  });

  test('Tenant A no lee, modifica ni desactiva un cliente de Tenant B', async () => {
    const clientB = await createClient(adminB.token, { email: 'b@example.com' });

    await request(app).get(`/api/clients/${clientB.id}`).set(bearer(adminA.token)).expect(404);
    await request(app)
      .put(`/api/clients/${clientB.id}`)
      .set(bearer(adminA.token))
      .send({ name: 'Intrusión' })
      .expect(404);
    await request(app).delete(`/api/clients/${clientB.id}`).set(bearer(adminA.token)).expect(404);

    const untouched = await request(app)
      .get(`/api/clients/${clientB.id}`)
      .set(bearer(adminB.token))
      .expect(200);
    assert.equal(untouched.body.data.name, 'Cliente Uno');
    assert.equal(untouched.body.data.active, true);
  });

  test('completa CRUD de empleados y valida vínculo PROFESSIONAL same-tenant', async () => {
    const professional = await createUser(adminA.token, 'PROFESSIONAL', 'pro@example.com');
    const employee = await createEmployee(adminA.token, { userId: professional.id });
    assert.equal(employee.userId, professional.id);

    const updated = await request(app)
      .put(`/api/employees/${employee.id}`)
      .set(bearer(adminA.token))
      .send({ phone: '+51 900 000 001' })
      .expect(200);
    assert.equal(updated.body.data.phone, '+51 900 000 001');

    await request(app).delete(`/api/employees/${employee.id}`).set(bearer(adminA.token)).expect(204);
    assert.equal(db.prepare('SELECT active FROM employees WHERE id = ?').get(employee.id).active, 0);

    const professionalB = await createUser(adminB.token, 'PROFESSIONAL', 'prob@example.com');
    await request(app)
      .post('/api/employees')
      .set(bearer(adminA.token))
      .send({ name: 'Cross tenant', userId: professionalB.id })
      .expect(404);
  });

  test('completa CRUD de servicios y rechaza duración/precio inválidos', async () => {
    const service = await createService(adminA.token);
    const updated = await request(app)
      .put(`/api/services/${service.id}`)
      .set(bearer(adminA.token))
      .send({ durationMinutes: 75, priceCents: 15000 })
      .expect(200);
    assert.equal(updated.body.data.durationMinutes, 75);
    assert.equal(updated.body.data.priceCents, 15000);

    await request(app).post('/api/services').set(bearer(adminA.token)).send({
      name: 'Duración mala', durationMinutes: 0, priceCents: 0,
    }).expect(422);
    await request(app).post('/api/services').set(bearer(adminA.token)).send({
      name: 'Precio malo', durationMinutes: 60, priceCents: -1,
    }).expect(422);

    await request(app).delete(`/api/services/${service.id}`).set(bearer(adminA.token)).expect(204);
    assert.equal(db.prepare('SELECT active FROM services WHERE id = ?').get(service.id).active, 0);
  });

  test('asocia servicios same-tenant y rechaza una asociación con Tenant B', async () => {
    const employeeA = await createEmployee(adminA.token);
    const serviceA = await createService(adminA.token);
    const serviceB = await createService(adminB.token, { name: 'Servicio B', email: undefined });

    const associated = await request(app)
      .put(`/api/employees/${employeeA.id}/services`)
      .set(bearer(adminA.token))
      .send({ serviceIds: [serviceA.id] })
      .expect(200);
    assert.equal(associated.body.data.length, 1);
    assert.equal(associated.body.data[0].id, serviceA.id);

    await request(app)
      .put(`/api/employees/${employeeA.id}/services`)
      .set(bearer(adminA.token))
      .send({ serviceIds: [serviceB.id] })
      .expect(404);

    const stillAssociated = await request(app)
      .get(`/api/employees/${employeeA.id}/services`)
      .set(bearer(adminA.token))
      .expect(200);
    assert.deepEqual(stillAssociated.body.data.map(({ id }) => id), [serviceA.id]);
  });

  test('Tenant A no lee, modifica ni desactiva empleados, servicios u horarios de Tenant B', async () => {
    const employeeB = await createEmployee(adminB.token, { email: 'employee-b@example.com' });
    const serviceB = await createService(adminB.token, { name: 'Servicio B' });
    await request(app)
      .put(`/api/employees/${employeeB.id}/services`)
      .set(bearer(adminB.token))
      .send({ serviceIds: [serviceB.id] })
      .expect(200);
    await request(app)
      .post(`/api/employees/${employeeB.id}/schedules`)
      .set(bearer(adminB.token))
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' })
      .expect(201);

    await request(app).get(`/api/employees/${employeeB.id}`).set(bearer(adminA.token)).expect(404);
    await request(app).put(`/api/employees/${employeeB.id}`).set(bearer(adminA.token))
      .send({ name: 'Intrusion' }).expect(404);
    await request(app).delete(`/api/employees/${employeeB.id}`).set(bearer(adminA.token)).expect(404);
    await request(app).get(`/api/employees/${employeeB.id}/services`).set(bearer(adminA.token)).expect(404);
    await request(app).get(`/api/employees/${employeeB.id}/schedules`).set(bearer(adminA.token)).expect(404);
    await request(app).post(`/api/employees/${employeeB.id}/schedules`).set(bearer(adminA.token))
      .send({ dayOfWeek: 2, startTime: '09:00', endTime: '17:00' }).expect(404);

    await request(app).get(`/api/services/${serviceB.id}`).set(bearer(adminA.token)).expect(404);
    await request(app).put(`/api/services/${serviceB.id}`).set(bearer(adminA.token))
      .send({ name: 'Intrusion' }).expect(404);
    await request(app).delete(`/api/services/${serviceB.id}`).set(bearer(adminA.token)).expect(404);

    const untouchedEmployee = await request(app)
      .get(`/api/employees/${employeeB.id}`)
      .set(bearer(adminB.token))
      .expect(200);
    const untouchedService = await request(app)
      .get(`/api/services/${serviceB.id}`)
      .set(bearer(adminB.token))
      .expect(200);
    assert.equal(untouchedEmployee.body.data.name, 'Profesional Uno');
    assert.equal(untouchedEmployee.body.data.active, true);
    assert.equal(untouchedService.body.data.name, 'Servicio B');
    assert.equal(untouchedService.body.data.active, true);
  });

  test('gestiona horarios y rechaza bloques superpuestos', async () => {
    const employee = await createEmployee(adminA.token);
    const schedule = (await request(app)
      .post(`/api/employees/${employee.id}/schedules`)
      .set(bearer(adminA.token))
      .send({ dayOfWeek: 1, startTime: '09:00', endTime: '13:00' })
      .expect(201)).body.data;

    await request(app)
      .post(`/api/employees/${employee.id}/schedules`)
      .set(bearer(adminA.token))
      .send({ dayOfWeek: 1, startTime: '12:00', endTime: '14:00' })
      .expect(409);
    await request(app)
      .post(`/api/employees/${employee.id}/schedules`)
      .set(bearer(adminA.token))
      .send({ dayOfWeek: 1, startTime: '13:00', endTime: '17:00' })
      .expect(201);

    const updated = await request(app)
      .put(`/api/employees/${employee.id}/schedules/${schedule.id}`)
      .set(bearer(adminA.token))
      .send({ startTime: '08:00' })
      .expect(200);
    assert.equal(updated.body.data.startTime, '08:00');

    await request(app)
      .delete(`/api/employees/${employee.id}/schedules/${schedule.id}`)
      .set(bearer(adminA.token))
      .expect(204);
  });

  test('aplica RBAC y alcances contextuales de PROFESSIONAL y CLIENT', async () => {
    const receptionist = await createUser(adminA.token, 'RECEPTIONIST', 'recep@example.com');
    const professional = await createUser(adminA.token, 'PROFESSIONAL', 'prof@example.com');
    const clientUser = await createUser(adminA.token, 'CLIENT', 'client@example.com');
    const employee = await createEmployee(adminA.token, { userId: professional.id });
    const client = await createClient(adminA.token, { userId: clientUser.id, email: 'client-profile@example.com' });
    const service = await createService(adminA.token);
    await request(app).put(`/api/employees/${employee.id}/services`).set(bearer(adminA.token))
      .send({ serviceIds: [service.id] }).expect(200);

    const receptionistToken = await login('tenant-a', receptionist.email);
    const professionalToken = await login('tenant-a', professional.email);
    const clientToken = await login('tenant-a', clientUser.email);

    await request(app).post('/api/clients').set(bearer(receptionistToken))
      .send({ name: 'Cliente recepción' }).expect(201);
    await request(app).post('/api/employees').set(bearer(receptionistToken))
      .send({ name: 'No permitido' }).expect(403);
    await request(app).get('/api/users').set(bearer(receptionistToken)).expect(403);
    await request(app).put(`/api/employees/${employee.id}/services`).set(bearer(receptionistToken))
      .send({ serviceIds: [service.id] }).expect(403);
    await request(app).post('/api/services').set(bearer(professionalToken))
      .send({ name: 'No permitido', durationMinutes: 60, priceCents: 0 }).expect(403);
    await request(app).post('/api/clients').set(bearer(professionalToken))
      .send({ name: 'No permitido' }).expect(403);
    await request(app).get('/api/users').set(bearer(professionalToken)).expect(403);
    await request(app).post('/api/employees').set(bearer(clientToken))
      .send({ name: 'No permitido' }).expect(403);
    await request(app).get('/api/clients').set(bearer(clientToken)).expect(403);
    await request(app).get('/api/dashboard').set(bearer(clientToken)).expect(403);

    const ownEmployee = await request(app).get('/api/employees').set(bearer(professionalToken)).expect(200);
    assert.deepEqual(ownEmployee.body.data.map(({ id }) => id), [employee.id]);
    await request(app).get(`/api/clients/${client.id}`).set(bearer(clientToken)).expect(200);
    const clientB = await createClient(adminA.token, { email: 'another@example.com' });
    await request(app).get(`/api/clients/${clientB.id}`).set(bearer(clientToken)).expect(404);
  });
});
