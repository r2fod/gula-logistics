import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/WorkerBalance.model.js', () => ({
  WorkerBalance: { find: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { WorkerBalance } = await import('../models/WorkerBalance.model.js');
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

describe('PUT /api/balances/:id (actualización parcial de saldo)', () => {
  it('BUG real: un payload parcial sin $set lo trataría MongoDB como reemplazo total del documento, borrando name/avatar/purseInfo/etc.', async () => {
    // Este es justo el payload que manda persistWorkerBalance en
    // PartnerDashboardView.jsx al añadir un turno: solo breakdown y
    // currentBalance, nunca el documento completo (name, hasTransportBonus,
    // purseInfo...). Sin $set, findOneAndUpdate lo habría pasado tal cual a
    // MongoDB, que interpreta un objeto sin operadores como documento de
    // REEMPLAZO — borrando todos los campos no incluidos.
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'kerly', breakdown: [], currentBalance: 70 });
    const app = buildApp();
    const res = await request(app)
      .put('/api/balances/kerly')
      .set('Authorization', adminAuthHeader())
      .send({ breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 });

    expect(res.status).toBe(200);
    expect(WorkerBalance.findOneAndUpdate).toHaveBeenCalledWith(
      { id: 'kerly' },
      expect.objectContaining({
        $set: { breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 },
        $setOnInsert: { id: 'kerly' }
      }),
      expect.objectContaining({ upsert: true })
    );
    // Confirma explícitamente que el update NO se manda como objeto plano
    // (la forma que MongoDB trataría como reemplazo).
    const [, updateArg] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(updateArg).not.toEqual({ breakdown: [{ concept: 'x', amount: 70, isPositive: true }], currentBalance: 70 });
  });

  it('si el payload trae un "id" propio, se descarta (nunca debe competir con el id de la URL)', async () => {
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'kerly' });
    const app = buildApp();
    const res = await request(app)
      .put('/api/balances/kerly')
      .set('Authorization', adminAuthHeader())
      .send({ id: 'otro-id-cualquiera', currentBalance: 10 });

    expect(res.status).toBe(200);
    const [, updateArg] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(updateArg.$set.id).toBeUndefined();
    expect(updateArg.$setOnInsert).toEqual({ id: 'kerly' });
  });

  it('rechaza sin token de admin', async () => {
    const app = buildApp();
    const res = await request(app).put('/api/balances/kerly').send({ currentBalance: 10 });

    expect(res.status).toBe(401);
    expect(WorkerBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
