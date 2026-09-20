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

  it('descarta earnings/durationHours aunque se manden — son valores calculados, nunca los manda el flujo real', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '789', workerName: 'Ricardo', type: 'salida', timestamp: '2026-09-19T08:00:00.000Z', earnings: 99999, durationHours: 500 });

    expect(res.status).toBe(201);
    expect(ClockEntry.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ earnings: expect.anything(), durationHours: expect.anything() })
    );
  });

  it('rechaza un rate fuera de rango razonable (ej. inventado por alguien sin pasar por la UI)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '790', workerName: 'Ricardo', type: 'salida', timestamp: '2026-09-19T08:00:00.000Z', rate: 1000 });

    expect(res.status).toBe(400);
    expect(ClockEntry.create).not.toHaveBeenCalled();
  });

  it('rechaza un rate negativo o cero', async () => {
    const app = buildApp();
    const res1 = await request(app).post('/api/clock').send({ id: '791', workerName: 'Ricardo', type: 'salida', timestamp: 't', rate: -5 });
    const res2 = await request(app).post('/api/clock').send({ id: '792', workerName: 'Ricardo', type: 'salida', timestamp: 't', rate: 0 });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
  });

  it('acepta un rate legítimo dentro de rango (el flujo real de fichaje sí lo manda)', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '793', workerName: 'Irene', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z', rate: 14 });

    expect(res.status).toBe(201);
    expect(res.body.rate).toBe(14);
  });
});
