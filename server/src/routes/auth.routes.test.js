import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null), create: vi.fn() },
}));
vi.mock('../models/WorkerBalance.model.js', () => ({
  WorkerBalance: { find: vi.fn() },
}));

const authRoutes = (await import('./auth.routes.js')).default;
const { AdminConfig } = await import('../models/AdminConfig.model.js');
const { WorkerBalance } = await import('../models/WorkerBalance.model.js');
const { signToken, verifyToken } = await import('../utils/authToken.js');

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

describe('POST /api/auth/socias-token (enlace de socias de solo lectura)', () => {
  const admin = (v = 1) => `Bearer ${signToken({ role: 'admin', v })}`;

  it('exige sesión de admin (un enlace de socias no puede generar otros)', async () => {
    const app = buildApp();
    expect((await request(app).post('/api/auth/socias-token')).status).toBe(401);
    const socias = `Bearer ${signToken({ role: 'socias', v: 1, sv: 1 })}`;
    expect((await request(app).post('/api/auth/socias-token').set('Authorization', socias)).status).toBe(401);
  });

  it('devuelve un token de rol socias (nunca la sesión de admin) que caduca en ~90 días', async () => {
    const r = await request(buildApp()).post('/api/auth/socias-token').set('Authorization', admin());
    expect(r.status).toBe(200);
    const cuerpo = verifyToken(r.body.token);
    expect(cuerpo).toMatchObject({ role: 'socias', v: 1, sv: 1 });
    const dias = (cuerpo.exp - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(89);
    expect(dias).toBeLessThanOrEqual(90);
  });

  it('con anularAnteriores sube sociasVersion y el nuevo lleva la versión nueva', async () => {
    mongoose.connection.readyState = 1;
    const config = { tokenVersion: 3, sociasVersion: 1, save: vi.fn().mockResolvedValue() };
    AdminConfig.findOne.mockResolvedValue(config);
    const r = await request(buildApp()).post('/api/auth/socias-token').set('Authorization', admin(3)).send({ anularAnteriores: true });
    expect(r.status).toBe(200);
    expect(config.sociasVersion).toBe(2);
    expect(config.save).toHaveBeenCalled();
    expect(verifyToken(r.body.token)).toMatchObject({ role: 'socias', v: 3, sv: 2 });
    AdminConfig.findOne.mockResolvedValue(null);
  });
});

describe('GET /api/auth/sesion', () => {
  it('dice el rol de un enlace válido y 401 sin él', async () => {
    const app = buildApp();
    expect((await request(app).get('/api/auth/sesion')).status).toBe(401);
    const r = await request(app).get('/api/auth/sesion').set('Authorization', `Bearer ${signToken({ role: 'socias', v: 1, sv: 1 })}`);
    expect(r.body).toEqual({ rol: 'socias' });
  });
});

describe('POST /api/auth/enlaces-trabajadores (cada trabajador ve solo su saldo)', () => {
  const admin = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;
  const fichas = [{ id: 'ana', name: 'Ana' }, { id: 'luis-gula', name: 'Luis Gula' }];
  const conFichas = () => WorkerBalance.find.mockReturnValue({ lean: vi.fn().mockResolvedValue(fichas) });

  it('solo el admin los genera (ni socias ni un trabajador ni sin sesión)', async () => {
    const app = buildApp();
    mongoose.connection.readyState = 1;
    expect((await request(app).post('/api/auth/enlaces-trabajadores')).status).toBe(401);
    for (const rol of [{ role: 'socias', v: 1, sv: 1 }, { role: 'trabajador', w: 'ana', tv: 1 }]) {
      expect((await request(app).post('/api/auth/enlaces-trabajadores').set('Authorization', `Bearer ${signToken(rol)}`)).status).toBe(401);
    }
  });

  it('un enlace por ficha, firmado con su id y la versión de los enlaces (no la de la contraseña)', async () => {
    mongoose.connection.readyState = 1;
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 1, trabajadoresVersion: 3 });
    conFichas();
    const r = await request(buildApp()).post('/api/auth/enlaces-trabajadores').set('Authorization', admin());
    expect(r.status).toBe(200);
    expect(r.body.enlaces.map(e => e.id)).toEqual(['ana', 'luis-gula']);
    const cuerpo = verifyToken(r.body.enlaces[1].token);
    expect(cuerpo).toMatchObject({ role: 'trabajador', w: 'luis-gula', tv: 3 });
    expect(cuerpo.v).toBeUndefined();
    AdminConfig.findOne.mockResolvedValue(null);
  });

  it('"anular anteriores" sube la versión de los enlaces de trabajador', async () => {
    mongoose.connection.readyState = 1;
    const config = { tokenVersion: 1, trabajadoresVersion: 1, save: vi.fn() };
    AdminConfig.findOne.mockResolvedValue(config);
    conFichas();
    const r = await request(buildApp()).post('/api/auth/enlaces-trabajadores').set('Authorization', admin()).send({ anularAnteriores: true });
    expect(config.trabajadoresVersion).toBe(2);
    expect(config.save).toHaveBeenCalled();
    expect(verifyToken(r.body.enlaces[0].token).tv).toBe(2);
    AdminConfig.findOne.mockResolvedValue(null);
  });
});
