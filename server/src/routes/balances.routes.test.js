import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/WorkerBalance.model.js', () => ({
  WorkerBalance: { find: vi.fn(), findOneAndUpdate: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { WorkerBalance } = await import('../models/WorkerBalance.model.js');
const { AdminConfig } = await import('../models/AdminConfig.model.js');
const balancesRoutes = (await import('./balances.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/balances', balancesRoutes);
  return app;
}

function adminAuthHeader() {
  return `Bearer ${signToken({ role: 'admin', v: 1 })}`;
}

beforeEach(() => {
  process.env.AUTH_TOKEN_SECRET = 'secreto-de-test-no-real';
  vi.clearAllMocks();
  mongoose.connection.readyState = 1;
});

describe('GET /api/balances (dinero: solo admin o enlace de socias)', () => {
  it('BUG evitado: sin sesión NO devuelve los saldos (antes eran públicos)', async () => {
    const r = await request(buildApp()).get('/api/balances');
    expect(r.status).toBe(401);
    expect(WorkerBalance.find).not.toHaveBeenCalled();
  });

  it('con enlace de socias o sesión de admin sí', async () => {
    WorkerBalance.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([{ id: 'ana', name: 'Ana' }]) });
    const socias = `Bearer ${signToken({ role: 'socias', v: 1, sv: 1 })}`;
    const r = await request(buildApp()).get('/api/balances').set('Authorization', socias);
    expect(r.status).toBe(200);
    expect(r.body.workers).toEqual([{ id: 'ana', name: 'Ana' }]);
    expect((await request(buildApp()).get('/api/balances').set('Authorization', adminAuthHeader())).status).toBe(200);
  });
});

describe('PUT /api/balances/:id (actualización parcial de saldo)', () => {
  it('BUG real: un payload parcial sin $set lo trataría MongoDB como reemplazo total del documento, borrando name/avatar/purseInfo/etc.', async () => {
    // Este es justo el payload que manda persistWorkerBalance en
    // PartnerDashboardView.jsx al añadir un turno: solo breakdown y
    // currentBalance, nunca el documento completo (name, hasTransportBonus,
    // purseInfo...). Sin $set, findOneAndUpdate lo habría pasado tal cual a
    // MongoDB, que interpreta un objeto sin operadores como documento de
    // REEMPLAZO — borrando todos los campos no incluidos.
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'eva', breakdown: [], currentBalance: 70 });
    const app = buildApp();
    const res = await request(app)
      .put('/api/balances/eva')
      .set('Authorization', adminAuthHeader())
      .send({ breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 });

    expect(res.status).toBe(200);
    expect(WorkerBalance.findOneAndUpdate).toHaveBeenCalledWith(
      { id: 'eva' },
      expect.objectContaining({
        $set: { breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 },
        $setOnInsert: { id: 'eva' }
      }),
      expect.objectContaining({ upsert: true })
    );
    // Confirma explícitamente que el update NO se manda como objeto plano
    // (la forma que MongoDB trataría como reemplazo).
    const [, updateArg] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(updateArg).not.toEqual({ breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 });
  });

  it('si el payload trae un "id" propio, se descarta (nunca debe competir con el id de la URL)', async () => {
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'eva' });
    const app = buildApp();
    const res = await request(app)
      .put('/api/balances/eva')
      .set('Authorization', adminAuthHeader())
      .send({ id: 'otro-id-cualquiera', currentBalance: 10 });

    expect(res.status).toBe(200);
    const [, updateArg] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(updateArg.$set.id).toBeUndefined();
    expect(updateArg.$setOnInsert).toEqual({ id: 'eva' });
  });

  it('rechaza sin token de admin', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/balances/eva').send({ currentBalance: 10 });

    expect(res.status).toBe(401);
    expect(WorkerBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('GET /api/balances/mio (el trabajador ve SOLO su saldo)', () => {
  const trabajador = (w, tv = 1) => `Bearer ${signToken({ role: 'trabajador', w, tv })}`;
  const devuelve = (ficha) => WorkerBalance.findOne.mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(ficha) }) });

  it('sin enlace firmado, o con la sesión de admin/socias, no responde', async () => {
    const app = buildApp();
    expect((await request(app).get('/api/balances/mio')).status).toBe(401);
    expect((await request(app).get('/api/balances/mio').set('Authorization', adminAuthHeader())).status).toBe(401);
    expect(WorkerBalance.findOne).not.toHaveBeenCalled();
  });

  it('devuelve la ficha del id que va DENTRO del enlace (no se puede pedir la de otro)', async () => {
    devuelve({ id: 'ana', name: 'Ana', currentBalance: 12 });
    const r = await request(buildApp()).get('/api/balances/mio?id=luis').set('Authorization', trabajador('ana'));
    expect(r.status).toBe(200);
    expect(WorkerBalance.findOne).toHaveBeenCalledWith({ id: 'ana' });
    expect(r.body.name).toBe('Ana');
  });

  it('BUG evitado: el enlace de un trabajador NO abre los saldos de todos', async () => {
    const r = await request(buildApp()).get('/api/balances').set('Authorization', trabajador('ana'));
    expect(r.status).toBe(401);
    expect(WorkerBalance.find).not.toHaveBeenCalled();
  });

  it('un enlace anulado deja de valer; cambiar la contraseña de admin NO lo anula', async () => {
    devuelve({ id: 'ana', name: 'Ana' });
    AdminConfig.findOne.mockResolvedValue({ tokenVersion: 7, trabajadoresVersion: 2 });
    expect((await request(buildApp()).get('/api/balances/mio').set('Authorization', trabajador('ana', 1))).status).toBe(401);
    expect((await request(buildApp()).get('/api/balances/mio').set('Authorization', trabajador('ana', 2))).status).toBe(200);
    AdminConfig.findOne.mockResolvedValue(null);
  });
});
