import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/ClockEntry.model.js', () => ({
  ClockEntry: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
// requireAdmin consulta AdminConfig para la revocación por cambio de
// contraseña; la simulamos "sin config" para que ese chequeo no interfiera
// con estos tests (ver requireAdmin.test.js para su cobertura dedicada).
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { ClockEntry } = await import('../models/ClockEntry.model.js');
const clockRoutes = (await import('./clock.routes.js')).default;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/clock', clockRoutes);
  return app;
}

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  vi.clearAllMocks();
  mongoose.connection.readyState = 1;
});

describe('POST /api/clock', () => {
  it('crea un fichaje nuevo normal', async () => {
    ClockEntry.create.mockResolvedValue({ id: '123', workerName: 'Ricardo', type: 'entrada' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '123', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(ClockEntry.create).toHaveBeenCalledWith(expect.objectContaining({ id: '123', workerName: 'Ricardo' }));
  });

  it('id duplicado (reintento tras un fichaje offline que en realidad sí se guardó): devuelve 200 con el existente, no 500', async () => {
    // Simula el error real de Mongo por el índice único de `id`.
    const dupError = new Error('E11000 duplicate key error collection: gula.clockentries index: id_1 dup key: { id: "123" }');
    dupError.code = 11000;
    ClockEntry.create.mockRejectedValue(dupError);
    ClockEntry.findOne.mockResolvedValue({ id: '123', workerName: 'Ricardo', type: 'entrada' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '123', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: '123', workerName: 'Ricardo' });
    // No se intenta crear un segundo documento con el mismo id.
    expect(ClockEntry.create).toHaveBeenCalledTimes(1);
  });

  it('un error real de guardado (no duplicado) sigue devolviendo 500', async () => {
    ClockEntry.create.mockRejectedValue(new Error('Fallo de conexión a Mongo'));
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '456', workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(500);
  });

  it('genera un id automático si no se manda ninguno', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ workerName: 'Ricardo', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });
});
