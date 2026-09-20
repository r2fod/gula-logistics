import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null), create: vi.fn() },
}));

const authRoutes = (await import('./auth.routes.js')).default;

// trust proxy = 1, igual que en server.js: sin esto req.ip ignoraría
// X-Forwarded-For y todos los tests compartirían la misma IP.
function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  return app;
}

const PASSWORD = 'contraseña-de-test-no-real';
let ipCounter = 0;
// Cada test usa su propia IP para no heredar intentos fallidos de otro.
const nextIp = () => `10.0.0.${++ipCounter}`;

const login = (app, ip, password) =>
  request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({ password });

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  process.env.ADMIN_BOOTSTRAP_PASSWORD = PASSWORD;
  // Sin Mongo: usa la rama de respaldo que compara con ADMIN_BOOTSTRAP_PASSWORD.
  mongoose.connection.readyState = 0;
});

describe('POST /api/auth/login (límite de intentos fallidos por IP)', () => {
  it('con la contraseña correcta devuelve un token', async () => {
    const res = await login(buildApp(), nextIp(), PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('tras 10 intentos fallidos, el 11º se bloquea con 429 + Retry-After — aunque sea con la contraseña correcta', async () => {
    const app = buildApp();
    const ip = nextIp();

    for (let i = 0; i < 10; i++) {
      const res = await login(app, ip, 'incorrecta');
      expect(res.status).toBe(401);
    }

    const blocked = await login(app, ip, PASSWORD);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body.token).toBeUndefined();
  });

  it('un login correcto borra el contador: acertar tras 9 fallos no arrastra esos intentos', async () => {
    const app = buildApp();
    const ip = nextIp();

    for (let i = 0; i < 9; i++) await login(app, ip, 'incorrecta');
    const ok = await login(app, ip, PASSWORD);
    expect(ok.status).toBe(200);

    // Si no se hubiera reiniciado, el 2º fallo de esta tanda ya bloquearía.
    for (let i = 0; i < 9; i++) {
      const res = await login(app, ip, 'incorrecta');
      expect(res.status).toBe(401);
    }
  });

  it('el bloqueo es por IP: otra IP distinta sigue pudiendo entrar', async () => {
    const app = buildApp();
    const bloqueada = nextIp();
    const otra = nextIp();

    for (let i = 0; i < 10; i++) await login(app, bloqueada, 'incorrecta');
    expect((await login(app, bloqueada, PASSWORD)).status).toBe(429);
    expect((await login(app, otra, PASSWORD)).status).toBe(200);
  });

  it('una petición sin contraseña (400) no cuenta como intento fallido', async () => {
    const app = buildApp();
    const ip = nextIp();

    for (let i = 0; i < 15; i++) {
      const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip).send({});
      expect(res.status).toBe(400);
    }
    expect((await login(app, ip, PASSWORD)).status).toBe(200);
  });

  it('BUG evitado: falsificar X-Forwarded-For por la izquierda no permite saltarse el límite', async () => {
    // El proxy de Render AÑADE la IP real a la derecha; el cliente solo
    // controla lo que pone a la izquierda. Con `trust proxy: true` (toma la
    // izquierda) rotar ese valor en cada intento habría evitado el bloqueo.
    const app = buildApp();
    const ipReal = nextIp();

    for (let i = 0; i < 10; i++) {
      const res = await login(app, `falsa-${i}, ${ipReal}`, 'incorrecta');
      expect(res.status).toBe(401);
    }
    const blocked = await login(app, `otra-falsa, ${ipReal}`, PASSWORD);
    expect(blocked.status).toBe(429);
  });
});
