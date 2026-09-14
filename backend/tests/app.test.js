import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createDatabase, initializeDatabase } from '../src/database/database.js';

describe('base de la API Express', () => {
  let db;
  let app;

  before(() => {
    process.env.NODE_ENV = 'test';
    db = initializeDatabase(createDatabase(':memory:'));
    app = createApp({
      db,
      env: {
        frontendOrigin: 'http://localhost:5173',
        jwtSecret: 'test-secret-with-at-least-32-characters-long',
        jwtExpiresIn: '2h',
        bcryptRounds: 10,
      },
    });
  });

  after(() => db.close());

  test('GET /api/health confirma proceso y SQLite', async () => {
    const response = await request(app).get('/api/health').expect(200);

    assert.equal(response.body.data.status, 'ok');
    assert.equal(response.body.data.database, 'ok');
    assert.match(response.body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(response.headers['x-powered-by'], undefined);
    assert.ok(response.headers['content-security-policy']);
  });

  test('responde 404 con el contrato de error uniforme', async () => {
    const response = await request(app).get('/api/no-existe').expect(404);

    assert.deepEqual(response.body, {
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'No existe GET /api/no-existe.',
        details: [],
      },
    });
  });

  test('rechaza JSON malformado sin exponer stack', async () => {
    const response = await request(app)
      .post('/api/no-existe')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);

    assert.equal(response.body.error.code, 'INVALID_JSON');
    assert.equal(response.body.error.stack, undefined);
  });

  test('rechaza orígenes no autorizados', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example')
      .expect(403);

    assert.equal(response.body.error.code, 'ORIGIN_NOT_ALLOWED');
  });
});
