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
  it('no devuelve el rastro interno (apuntesBorrados) a quien solo lee', async () => {
    WorkerBalance.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([]) });
    await request(buildApp()).get('/api/balances').set('Authorization', adminAuthHeader());
    expect(WorkerBalance.find).toHaveBeenCalledWith({}, '-apuntesBorrados');
  });

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

describe('PUT /api/balances/:id — dinero: validación, saldo calculado en el servidor y rastro', () => {
  const guardar = (cuerpo) => request(buildApp()).put('/api/balances/eva').set('Authorization', adminAuthHeader()).send(cuerpo);
  const apunte = (extra = {}) => ({ concept: 'Transporte', amount: 10, ...extra });

  beforeEach(() => {
    WorkerBalance.findOne.mockResolvedValue(null);
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'eva' });
  });

  it('rechaza (400) importes que no son números finitos o desorbitados, y conceptos vacíos, sin escribir', async () => {
    for (const malo of [apunte({ amount: 'diez' }), apunte({ amount: null }), apunte({ amount: 1e9 }), apunte({ concept: '   ' }), apunte({ concept: 5 }), 'texto']) {
      const r = await guardar({ breakdown: [malo] });
      expect(r.status, JSON.stringify(malo)).toBe(400);
    }
    expect((await guardar({ breakdown: 'no es lista' })).status).toBe(400);
    expect(WorkerBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza una fecha o un tipo que no existen', async () => {
    expect((await guardar({ breakdown: [apunte({ date: '13/10/2026' })] })).status).toBe(400);
    expect((await guardar({ breakdown: [apunte({ tipo: 'regalo' })] })).status).toBe(400);
    expect(WorkerBalance.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('BUG evitado: el saldo lo calcula el servidor con los apuntes (no se fía del currentBalance del navegador) y al céntimo', async () => {
    const r = await guardar({ breakdown: [apunte({ amount: 0.1 }), apunte({ amount: 0.2 }), apunte({ amount: -5.006, tipo: 'pago' })], currentBalance: 99999 });
    expect(r.status).toBe(200);
    const [, update] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(update.$set.currentBalance).toBe(-4.71); // 0,10 + 0,20 − 5,01 (cada importe al céntimo)
    expect(update.$set.breakdown.map(b => b.amount)).toEqual([0.1, 0.2, -5.01]);
  });

  it('BUG evitado: no se puede saltar la validación con rutas con punto o con $, ni vaciar el rastro, ni mandar un saldo suelto', async () => {
    expect((await guardar({ 'breakdown.0.amount': 99999 })).status).toBe(400);
    expect((await guardar({ $set: { currentBalance: 5 } })).status).toBe(400);
    expect(WorkerBalance.findOneAndUpdate).not.toHaveBeenCalled();

    await guardar({ name: 'Eva', apuntesBorrados: [], _id: 'x', createdAt: 'y', updatedAt: 'z', currentBalance: 12345, cosaRara: 1 });
    const [, update] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({ name: 'Eva' }); // solo campos de la ficha; el saldo sale de los apuntes
  });

  it('un apunte antiguo con campos null (date, tipo…) se acepta y se limpia, no bloquea el guardado de la ficha', async () => {
    const r = await guardar({ breakdown: [apunte({ date: null, tipo: null, timestamp: null, isPositive: null, horasBolsa: null })] });
    expect(r.status).toBe(200);
    expect(WorkerBalance.findOneAndUpdate.mock.calls[0][1].$set.breakdown).toEqual([{ concept: 'Transporte', amount: 10 }]);
  });

  it('BUG evitado: si la ficha cambió entre leerla y guardarla (otro admin), 409 y no se pisa; la escritura va filtrada por su versión', async () => {
    WorkerBalance.findOne.mockResolvedValue({ breakdown: [apunte()], updatedAt: new Date('2026-11-01T10:00:00Z') });
    WorkerBalance.findOneAndUpdate.mockResolvedValue(null);
    const r = await guardar({ breakdown: [apunte(), apunte({ amount: 5 })] });
    expect(r.status).toBe(409);
    const [filtro, , opciones] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(filtro).toEqual({ id: 'eva', updatedAt: new Date('2026-11-01T10:00:00Z') });
    expect(opciones.upsert).toBeFalsy(); // existe: nunca se intenta crear otra con el mismo id
  });

  it('la línea «Valor Acumulado Horas Bolsa» que se sustituye en cada turno no llena el rastro', async () => {
    WorkerBalance.findOne.mockResolvedValue({ breakdown: [{ concept: 'Valor Acumulado Horas Bolsa (6h a 8€/h)', amount: 48 }], updatedAt: new Date() });
    WorkerBalance.findOneAndUpdate.mockResolvedValue({ id: 'eva' });
    await guardar({ breakdown: [{ concept: 'Valor Acumulado Horas Bolsa (9h a 8€/h)', amount: 72 }] });
    expect(WorkerBalance.findOneAndUpdate.mock.calls[0][1].$push).toBeUndefined();
  });

  it('quitar un pago deja rastro (apuntesBorrados); cambiar solo su fecha NO', async () => {
    const pago = { concept: 'Efectivo', amount: -100, date: '2026-10-13', tipo: 'pago' };
    WorkerBalance.findOne.mockResolvedValue({ breakdown: [apunte(), pago], updatedAt: new Date('2026-11-01T10:00:00Z') });

    await guardar({ breakdown: [apunte(), { ...pago, date: '2026-10-14' }] });
    expect(WorkerBalance.findOneAndUpdate.mock.calls[0][1].$push).toBeUndefined();

    WorkerBalance.findOneAndUpdate.mockClear();
    await guardar({ breakdown: [apunte()] });
    const [, update] = WorkerBalance.findOneAndUpdate.mock.calls[0];
    expect(update.$push.apuntesBorrados.$each).toEqual([expect.objectContaining({ concept: 'Efectivo', amount: -100, tipo: 'pago', borradoEn: expect.any(String) })]);
    expect(update.$push.apuntesBorrados.$slice).toBe(-200);
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
