import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase, initializeDatabase } from '../src/database/database.js';

const jwtSecret = 'test-secret-with-at-least-32-characters-long';

function registration(overrides = {}) {
  return {
    organizationName: 'Clínica Central',
    tenantSlug: 'clinica-central',
    timezone: 'America/Lima',
    adminName: 'Admin Principal',
    email: 'admin@example.com',
    password: 'SecurePass123',
    ...overrides,
  };
}

describe('autenticación, tenant context y RBAC', () => {
  let db;
  let app;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    db = initializeDatabase(createDatabase(':memory:'));
    app = createApp({
      db,
      env: {
        frontendOrigin: 'http://localhost:5173',
        jwtSecret,
        jwtExpiresIn: '2h',
        bcryptRounds: 10,
      },
    });
  });

  afterEach(() => db.close());

  async function registerAdmin(overrides) {
    return request(app).post('/api/auth/register').send(registration(overrides)).expect(201);
  }

  test('crea tenant y ADMIN inicial de forma atómica', async () => {
    const response = await registerAdmin();

    assert.ok(response.body.data.token);
    assert.equal(response.body.data.user.role, 'ADMIN');
    assert.equal(response.body.data.user.email, 'admin@example.com');
    assert.equal(response.body.data.user.passwordHash, undefined);
    assert.equal(response.body.data.tenant.slug, 'clinica-central');
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM tenants').get().total, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM users').get().total, 1);
    assert.match(db.prepare('SELECT password_hash FROM users').get().password_hash, /^\$2[aby]\$/);
  });

  test('rechaza datos de registro inválidos y slug duplicado', async () => {
    await request(app)
      .post('/api/auth/register')
      .send(registration({ email: 'no-es-email' }))
      .expect(422);

    await registerAdmin();
    const duplicate = await request(app)
      .post('/api/auth/register')
      .send(registration({ email: 'other@example.com' }))
      .expect(409);

    assert.equal(duplicate.body.error.code, 'RESOURCE_CONFLICT');
    assert.equal(db.prepare('SELECT COUNT(*) AS total FROM users').get().total, 1);
  });

  test('permite login válido y /me devuelve la identidad actual', async () => {
    await registerAdmin();
    const login = await request(app).post('/api/auth/login').send({
      tenantSlug: 'clinica-central',
      email: 'ADMIN@example.com',
      password: 'SecurePass123',
    }).expect(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(200);

    assert.equal(me.body.data.tenantSlug, 'clinica-central');
    assert.equal(me.body.data.role, 'ADMIN');
  });

  test('login incorrecto no revela qué credencial falló', async () => {
    await registerAdmin();
    const response = await request(app).post('/api/auth/login').send({
      tenantSlug: 'clinica-central',
      email: 'admin@example.com',
      password: 'WrongPass123',
    }).expect(401);

    assert.deepEqual(response.body.error, {
      code: 'INVALID_CREDENTIALS',
      message: 'Las credenciales no son válidas.',
      details: [],
    });
  });

  test('protege rutas sin token y con token inválido o algoritmo no permitido', async () => {
    await request(app).get('/api/users').expect(401);
    await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    const wrongAlgorithmToken = jwt.sign(
      { tenantId: 'fake', role: 'ADMIN' },
      jwtSecret,
      { algorithm: 'HS384', subject: 'fake', issuer: 'reservapro-api', audience: 'reservapro-web' },
    );
    const response = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${wrongAlgorithmToken}`)
      .expect(401);
    assert.equal(response.body.error.code, 'INVALID_TOKEN');
  });

  test('ADMIN gestiona usuarios y RECEPTIONIST no accede a operaciones exclusivas', async () => {
    const admin = await registerAdmin();
    const adminToken = admin.body.data.token;
    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Recepción Uno',
        email: 'recepcion@example.com',
        password: 'Reception123',
        role: 'RECEPTIONIST',
      })
      .expect(201);

    assert.equal(created.body.data.role, 'RECEPTIONIST');
    const list = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(list.body.meta.total, 2);

    const login = await request(app).post('/api/auth/login').send({
      tenantSlug: 'clinica-central',
      email: 'recepcion@example.com',
      password: 'Reception123',
    }).expect(200);
    const forbidden = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(403);
    assert.equal(forbidden.body.error.code, 'FORBIDDEN');
  });

  test('un token previo deja de servir cuando ADMIN desactiva la cuenta', async () => {
    const admin = await registerAdmin();
    const adminToken = admin.body.data.token;
    const client = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cliente Uno',
        email: 'client@example.com',
        password: 'ClientPass123',
        role: 'CLIENT',
      })
      .expect(201);
    const login = await request(app).post('/api/auth/login').send({
      tenantSlug: 'clinica-central',
      email: 'client@example.com',
      password: 'ClientPass123',
    }).expect(200);

    await request(app)
      .delete(`/api/users/${client.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .expect(401);
  });

  test('impide que ADMIN se desactive o cambie su propio rol', async () => {
    const admin = await registerAdmin();
    const { token, user } = admin.body.data;

    await request(app)
      .delete(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409);
    await request(app)
      .put(`/api/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'CLIENT' })
      .expect(409);
  });
});
