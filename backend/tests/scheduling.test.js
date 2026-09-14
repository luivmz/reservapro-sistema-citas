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
const date = '2030-01-07'; // lunes
const at = (time) => `${date}T${time}:00-05:00`;

describe('disponibilidad, citas y conflictos', () => {
  let db;
  let app;
  let a;
  let b;

  beforeEach(async () => {
    process.env.NODE_ENV = 'test';
    db = initializeDatabase(createDatabase(':memory:'));
    app = createApp({ db, env });
    a = await setupTenant('a');
    b = await setupTenant('b');
  });

  afterEach(() => db.close());

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  async function register(suffix) {
    return (await request(app).post('/api/auth/register').send({
      organizationName: `Tenant ${suffix.toUpperCase()}`,
      tenantSlug: `tenant-${suffix}`,
      adminName: `Admin ${suffix.toUpperCase()}`,
      email: 'admin@example.com',
      password: 'AdminPass123',
    }).expect(201)).body.data;
  }

  async function createClient(token, name = 'Cliente') {
    return (await request(app).post('/api/clients').set(bearer(token)).send({ name }).expect(201)).body.data;
  }

  async function createEmployee(token, name = 'Profesional') {
    return (await request(app).post('/api/employees').set(bearer(token)).send({ name }).expect(201)).body.data;
  }

  async function createService(token, durationMinutes, name = `Servicio ${durationMinutes}`) {
    return (await request(app).post('/api/services').set(bearer(token)).send({
      name,
      durationMinutes,
      priceCents: 10000,
    }).expect(201)).body.data;
  }

  async function associate(token, employeeId, serviceIds) {
    await request(app).put(`/api/employees/${employeeId}/services`).set(bearer(token))
      .send({ serviceIds }).expect(200);
  }

  async function addSchedule(token, employeeId, startTime = '08:00', endTime = '18:00') {
    return (await request(app).post(`/api/employees/${employeeId}/schedules`).set(bearer(token))
      .send({ dayOfWeek: 1, startTime, endTime }).expect(201)).body.data;
  }

  async function setupTenant(suffix) {
    const admin = await register(suffix);
    const client = await createClient(admin.token, `Cliente ${suffix}`);
    const employee = await createEmployee(admin.token, `Profesional ${suffix}`);
    const service60 = await createService(admin.token, 60, `Consulta ${suffix}`);
    await associate(admin.token, employee.id, [service60.id]);
    await addSchedule(admin.token, employee.id);
    return { ...admin, client, employee, service60 };
  }

  async function appointment(fixture, startAt, serviceId = fixture.service60.id, overrides = {}) {
    return (await request(app).post('/api/appointments').set(bearer(fixture.token)).send({
      clientId: fixture.client.id,
      employeeId: fixture.employee.id,
      serviceId,
      startAt,
      ...overrides,
    }).expect(201)).body.data;
  }

  test('deriva endAt del servicio, valida jornada/asociación y calcula slots', async () => {
    const created = await appointment(a, at('10:00'), a.service60.id, {
      endAt: at('10:05'),
      notes: 'Final enviado por cliente debe ignorarse',
    });
    assert.equal(created.startAt, '2030-01-07T15:00:00.000Z');
    assert.equal(created.endAt, '2030-01-07T16:00:00.000Z');

    const availability = await request(app)
      .get(`/api/availability?employeeId=${a.employee.id}&serviceId=${a.service60.id}&date=${date}`)
      .set(bearer(a.token))
      .expect(200);
    const starts = availability.body.data.slots.map(({ startAt }) => startAt);
    assert.ok(starts.includes('2030-01-07T14:00:00.000Z'));
    assert.ok(!starts.includes('2030-01-07T15:00:00.000Z'));

    await request(app).post('/api/appointments').set(bearer(a.token)).send({
      clientId: a.client.id,
      employeeId: a.employee.id,
      serviceId: a.service60.id,
      startAt: at('17:30'),
    }).expect(422);

    const unoffered = await createService(a.token, 45, 'No asociado');
    await request(app)
      .get(`/api/availability?employeeId=${a.employee.id}&serviceId=${unoffered.id}&date=${date}`)
      .set(bearer(a.token))
      .expect(422);

    const shortEmployee = await createEmployee(a.token, 'Jornada corta');
    await associate(a.token, shortEmployee.id, [a.service60.id]);
    await addSchedule(a.token, shortEmployee.id, '16:30', '17:00');
    const noSlots = await request(app)
      .get(`/api/availability?employeeId=${shortEmployee.id}&serviceId=${a.service60.id}&date=${date}`)
      .set(bearer(a.token))
      .expect(200);
    assert.deepEqual(noSlots.body.data.slots, []);
  });

  test('cubre los diez escenarios obligatorios de conflicto y reprogramación', async () => {
    const service30 = await createService(a.token, 30);
    const service180 = await createService(a.token, 180);
    await associate(a.token, a.employee.id, [a.service60.id, service30.id, service180.id]);

    const conflicts = [
      ['coincidencia exacta', '10:00', a.service60.id],
      ['inicio dentro', '10:30', a.service60.id],
      ['final dentro', '09:30', a.service60.id],
      ['nueva contenida', '10:15', service30.id],
      ['nueva engloba existente', '09:00', service180.id],
    ];

    for (const [, start, serviceId] of conflicts) {
      db.prepare('DELETE FROM appointments').run();
      await appointment(a, at('10:00'));
      const response = await request(app).post('/api/appointments').set(bearer(a.token)).send({
        clientId: a.client.id,
        employeeId: a.employee.id,
        serviceId,
        startAt: at(start),
      });
      assert.equal(response.status, 409, JSON.stringify(response.body));
      assert.equal(response.body.error.code, 'APPOINTMENT_CONFLICT');
    }

    db.prepare('DELETE FROM appointments').run();
    await appointment(a, at('10:00'));
    const other = await createEmployee(a.token, 'Otro profesional');
    await associate(a.token, other.id, [a.service60.id]);
    await addSchedule(a.token, other.id);
    await request(app).post('/api/appointments').set(bearer(a.token)).send({
      clientId: a.client.id,
      employeeId: other.id,
      serviceId: a.service60.id,
      startAt: at('10:00'),
    }).expect(201);

    db.prepare('DELETE FROM appointments').run();
    await appointment(a, at('10:00'));
    await appointment(b, at('10:00'));

    db.prepare('DELETE FROM appointments').run();
    const existing = await appointment(a, at('10:00'));
    await request(app).patch(`/api/appointments/${existing.id}/cancel`).set(bearer(a.token)).expect(200);
    await appointment(a, at('10:00'));

    db.prepare('DELETE FROM appointments').run();
    let movable = await appointment(a, at('09:00'));
    await appointment(a, at('11:00'));
    await request(app).patch(`/api/appointments/${movable.id}/reschedule`).set(bearer(a.token))
      .send({ startAt: at('11:00') }).expect(409);
    const unchanged = await request(app).get(`/api/appointments/${movable.id}`).set(bearer(a.token)).expect(200);
    assert.equal(unchanged.body.data.startAt, '2030-01-07T14:00:00.000Z');

    db.prepare('DELETE FROM appointments').run();
    movable = await appointment(a, at('09:00'));
    const moved = await request(app).patch(`/api/appointments/${movable.id}/reschedule`).set(bearer(a.token))
      .send({ startAt: at('13:00') }).expect(200);
    assert.equal(moved.body.data.startAt, '2030-01-07T18:00:00.000Z');
  });

  test('edita notas, filtra combinando criterios y aplica estados válidos', async () => {
    const first = await appointment(a, at('09:00'));
    const second = await appointment(a, at('11:00'));

    const updated = await request(app).put(`/api/appointments/${first.id}`).set(bearer(a.token))
      .send({ notes: 'Nota actualizada' }).expect(200);
    assert.equal(updated.body.data.notes, 'Nota actualizada');

    await request(app).patch(`/api/appointments/${first.id}/status`).set(bearer(a.token))
      .send({ status: 'CONFIRMED' }).expect(200);
    await request(app).patch(`/api/appointments/${first.id}/status`).set(bearer(a.token))
      .send({ status: 'COMPLETED' }).expect(200);
    await request(app).patch(`/api/appointments/${first.id}/status`).set(bearer(a.token))
      .send({ status: 'CONFIRMED' }).expect(409);
    await request(app).patch(`/api/appointments/${second.id}/cancel`).set(bearer(a.token)).expect(200);

    const filtered = await request(app)
      .get(`/api/appointments?clientId=${a.client.id}&employeeId=${a.employee.id}`
        + `&serviceId=${a.service60.id}&status=COMPLETED`
        + `&from=${encodeURIComponent(at('08:00'))}&to=${encodeURIComponent(at('12:00'))}`)
      .set(bearer(a.token))
      .expect(200);
    assert.deepEqual(filtered.body.data.map(({ id }) => id), [first.id]);
  });

  test('protege citas por tenant y por perfiles CLIENT/PROFESSIONAL', async () => {
    const appointmentA = await appointment(a, at('10:00'));
    const appointmentB = await appointment(b, at('10:00'));
    await request(app).get(`/api/appointments/${appointmentB.id}`).set(bearer(a.token)).expect(404);
    await request(app).patch(`/api/appointments/${appointmentB.id}/cancel`).set(bearer(a.token)).expect(404);

    const professionalUser = (await request(app).post('/api/users').set(bearer(a.token)).send({
      name: 'Profesional con login', email: 'prof@example.com', password: 'UserPassword123', role: 'PROFESSIONAL',
    }).expect(201)).body.data;
    const ownEmployee = await createEmployee(a.token, 'Profesional con login');
    await request(app).put(`/api/employees/${ownEmployee.id}`).set(bearer(a.token))
      .send({ userId: professionalUser.id }).expect(200);
    await associate(a.token, ownEmployee.id, [a.service60.id]);
    await addSchedule(a.token, ownEmployee.id);
    const ownAppointment = await request(app).post('/api/appointments').set(bearer(a.token)).send({
      clientId: a.client.id, employeeId: ownEmployee.id, serviceId: a.service60.id, startAt: at('12:00'),
    }).expect(201);
    const professionalToken = (await request(app).post('/api/auth/login').send({
      tenantSlug: 'tenant-a', email: professionalUser.email, password: 'UserPassword123',
    }).expect(200)).body.data.token;
    const professionalList = await request(app).get('/api/appointments').set(bearer(professionalToken)).expect(200);
    assert.deepEqual(professionalList.body.data.map(({ id }) => id), [ownAppointment.body.data.id]);
    await request(app).get(`/api/appointments/${appointmentA.id}`).set(bearer(professionalToken)).expect(404);
    await request(app).patch(`/api/appointments/${ownAppointment.body.data.id}/status`)
      .set(bearer(professionalToken)).send({ status: 'CONFIRMED' }).expect(200);

    const clientUser = (await request(app).post('/api/users').set(bearer(a.token)).send({
      name: 'Cliente con login', email: 'client@example.com', password: 'UserPassword123', role: 'CLIENT',
    }).expect(201)).body.data;
    const clientProfile = await createClient(a.token, 'Cliente con login');
    await request(app).put(`/api/clients/${clientProfile.id}`).set(bearer(a.token))
      .send({ userId: clientUser.id }).expect(200);
    const clientToken = (await request(app).post('/api/auth/login').send({
      tenantSlug: 'tenant-a', email: clientUser.email, password: 'UserPassword123',
    }).expect(200)).body.data.token;
    const clientCreated = await request(app).post('/api/appointments').set(bearer(clientToken)).send({
      clientId: a.client.id,
      employeeId: a.employee.id,
      serviceId: a.service60.id,
      startAt: at('14:00'),
    }).expect(201);
    assert.equal(clientCreated.body.data.clientId, clientProfile.id);
    await request(app).get(`/api/appointments/${appointmentA.id}`).set(bearer(clientToken)).expect(404);
    await request(app).patch(`/api/appointments/${clientCreated.body.data.id}/cancel`)
      .set(bearer(clientToken)).expect(200);
  });
});
