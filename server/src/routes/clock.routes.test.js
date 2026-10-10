import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/ClockEntry.model.js', () => ({
  ClockEntry: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
}));
// requireAdmin consulta AdminConfig para la revocación por cambio de
// contraseña; la simulamos "sin config" para que ese chequeo no interfiera
// con estos tests (ver requireAdmin.test.js para su cobertura dedicada).
vi.mock('../models/TeamRoster.model.js', () => ({
  TeamRoster: { findOne: vi.fn() },
}));
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { ClockEntry } = await import('../models/ClockEntry.model.js');
const { TeamRoster } = await import('../models/TeamRoster.model.js');
const { AdminConfig } = await import('../models/AdminConfig.model.js');
const { signToken } = await import('../utils/authToken.js');
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
  // Los fichajes de prueba son del 19/09/2026: "hoy" es ese día.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-19T10:00:00.000Z'));
  TeamRoster.findOne.mockResolvedValue({ workers: [{ name: 'Carlos' }, { name: 'Sofía' }, { name: 'Elena' }] });
});
afterEach(() => vi.useRealTimers());

describe('POST /api/clock', () => {
  it('crea un fichaje nuevo normal', async () => {
    ClockEntry.create.mockResolvedValue({ id: '123', workerName: 'Carlos', type: 'entrada' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '123', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(ClockEntry.create).toHaveBeenCalledWith(expect.objectContaining({ id: '123', workerName: 'Carlos' }));
  });

  it('id duplicado (reintento tras un fichaje offline que en realidad sí se guardó): devuelve 200 con el existente, no 500', async () => {
    // Simula el error real de Mongo por el índice único de `id`.
    const dupError = new Error('E11000 duplicate key error collection: gula.clockentries index: id_1 dup key: { id: "123" }');
    dupError.code = 11000;
    ClockEntry.create.mockRejectedValue(dupError);
    ClockEntry.findOne.mockResolvedValue({ id: '123', workerName: 'Carlos', type: 'entrada' });

    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '123', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: '123', workerName: 'Carlos' });
    // No se intenta crear un segundo documento con el mismo id.
    expect(ClockEntry.create).toHaveBeenCalledTimes(1);
  });

  it('un error real de guardado (no duplicado) sigue devolviendo 500', async () => {
    ClockEntry.create.mockRejectedValue(new Error('Fallo de conexión a Mongo'));
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '456', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(500);
  });

  it('genera un id automático si no se manda ninguno', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });

  it('descarta earnings/durationHours aunque se manden — son valores calculados, nunca los manda el flujo real', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '789', workerName: 'Carlos', type: 'salida', timestamp: '2026-09-19T08:00:00.000Z', earnings: 99999, durationHours: 500 });

    expect(res.status).toBe(201);
    expect(ClockEntry.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ earnings: expect.anything(), durationHours: expect.anything() })
    );
  });

  it('descarta `revisado` (dar por bueno un turno largo es solo del admin)', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const res = await request(buildApp())
      .post('/api/clock')
      .send({ id: '790', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z', revisado: true });
    expect(res.status).toBe(201);
    expect(ClockEntry.create).toHaveBeenCalledWith(expect.not.objectContaining({ revisado: expect.anything() }));
  });

  it('rechaza un rate fuera de rango razonable (ej. inventado por alguien sin pasar por la UI)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '790', workerName: 'Carlos', type: 'salida', timestamp: '2026-09-19T08:00:00.000Z', rate: 1000 });

    expect(res.status).toBe(400);
    expect(ClockEntry.create).not.toHaveBeenCalled();
  });

  it('rechaza un rate negativo o cero', async () => {
    const app = buildApp();
    const res1 = await request(app).post('/api/clock').send({ id: '791', workerName: 'Carlos', type: 'salida', timestamp: 't', rate: -5 });
    const res2 = await request(app).post('/api/clock').send({ id: '792', workerName: 'Carlos', type: 'salida', timestamp: 't', rate: 0 });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
  });

  it('acepta un rate legítimo dentro de rango (el flujo real de fichaje sí lo manda)', async () => {
    ClockEntry.create.mockImplementation(async (data) => data);
    const app = buildApp();
    const res = await request(app)
      .post('/api/clock')
      .send({ id: '793', workerName: 'Elena', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z', rate: 14 });

    expect(res.status).toBe(201);
    expect(res.body.rate).toBe(14);
  });
});

describe('POST /api/clock — lo que no vale sin sesión de admin', () => {
  const fichar = (datos, auth) => {
    const r = request(buildApp()).post('/api/clock');
    if (auth) r.set('Authorization', auth);
    return r.send({ id: 'n1', type: 'entrada', ...datos });
  };

  it('alguien que no está en el equipo: 400 y no se guarda', async () => {
    const res = await fichar({ workerName: 'Intruso', timestamp: '2026-09-19T08:00:00.000Z' });
    expect(res.status).toBe(400);
    expect(ClockEntry.create).not.toHaveBeenCalled();
  });

  it('el nombre se compara sin mayúsculas ni acentos', async () => {
    ClockEntry.create.mockImplementation(async (d) => d);
    expect((await fichar({ workerName: 'sofia', timestamp: '2026-09-19T08:00:00.000Z' })).status).toBe(201);
  });

  it('fecha en el futuro, muy antigua o que no es fecha: 400', async () => {
    expect((await fichar({ workerName: 'Carlos', timestamp: '2026-09-20T08:00:00.000Z' })).status).toBe(400);
    expect((await fichar({ workerName: 'Carlos', timestamp: '2026-07-01T08:00:00.000Z' })).status).toBe(400);
    expect((await fichar({ workerName: 'Carlos', timestamp: 'ayer' })).status).toBe(400);
    expect(ClockEntry.create).not.toHaveBeenCalled();
  });

  it('el admin sí puede apuntar una fecha antigua', async () => {
    ClockEntry.create.mockImplementation(async (d) => d);
    const res = await fichar({ workerName: 'Carlos', timestamp: '2026-07-01T08:00:00.000Z' }, `Bearer ${signToken({ role: 'admin', v: 1 })}`);
    expect(res.status).toBe(201);
  });

  it('sin equipo guardado no se bloquea a nadie (mejor guardar que perder un fichaje)', async () => {
    TeamRoster.findOne.mockResolvedValue(null);
    ClockEntry.create.mockImplementation(async (d) => d);
    expect((await fichar({ workerName: 'Cualquiera', timestamp: '2026-09-19T08:00:00.000Z' })).status).toBe(201);
  });
});

describe('POST /api/clock — fichar con el enlace personal', () => {
  const enlace = (w, tv = 1) => signToken({ role: 'trabajador', w, tv });
  const fichar = (workerName, cabeceras = {}) => {
    const r = request(buildApp()).post('/api/clock');
    Object.entries(cabeceras).forEach(([k, v]) => r.set(k, v));
    return r.send({ id: `f-${Math.random()}`, workerName, type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z', firmado: true });
  };
  beforeEach(() => ClockEntry.create.mockImplementation(async (d) => d));
  afterEach(() => AdminConfig.findOne.mockResolvedValue(null));

  it('con su enlace queda firmado; sin él (o con el de otra persona), no; lo que diga la petición no cuenta', async () => {
    expect((await fichar('Carlos', { 'X-Enlace': enlace('carlos') })).body.firmado).toBe(true);
    expect((await fichar('Carlos')).body.firmado).toBe(false);
    expect((await fichar('Carlos', { 'X-Enlace': enlace('sofia') })).body.firmado).toBe(false);
  });

  it('BUG evitado: con tildes también firma ("Sofía" y su ficha sofía-gula); y su nombre seguido de más', async () => {
    expect((await fichar('Sofía', { 'X-Enlace': enlace('sofía-gula') })).body.firmado).toBe(true);
    expect((await fichar('Elena', { 'X-Enlace': enlace('elena-lopez') })).body.firmado).toBe(true);
    expect((await fichar('Elena', { 'X-Enlace': enlace('helena') })).body.firmado).toBe(false);
  });

  it('un enlace anulado (versión vieja) no firma', async () => {
    AdminConfig.findOne.mockResolvedValue({ trabajadoresVersion: 2 });
    expect((await fichar('Carlos', { 'X-Enlace': enlace('carlos', 1) })).body.firmado).toBe(false);
  });

  it('si el admin lo exige: sin enlace, 401 y no se guarda; con enlace o con sesión de admin, sí', async () => {
    AdminConfig.findOne.mockResolvedValue({ exigirEnlaceAlFichar: true, tokenVersion: 1, trabajadoresVersion: 1 });
    const sin = await fichar('Carlos');
    expect(sin.status).toBe(401);
    expect(sin.body.codigo).toBe('ENLACE_REQUERIDO');
    expect(ClockEntry.create).not.toHaveBeenCalled();
    expect((await fichar('Carlos', { 'X-Enlace': enlace('carlos') })).status).toBe(201);
    expect((await fichar('Carlos', { Authorization: `Bearer ${signToken({ role: 'admin', v: 1 })}` })).status).toBe(201);
  });
});

describe('Sesión de admin anulada en las rutas abiertas de fichajes', () => {
  // Contraseña cambiada o «Cerrar todas las sesiones»: la base va por la versión 2.
  const anulada = () => `Bearer ${signToken({ role: 'admin', v: 1 })}`;
  beforeEach(() => AdminConfig.findOne.mockResolvedValue({ tokenVersion: 2, trabajadoresVersion: 1, exigirEnlaceAlFichar: true }));
  afterEach(() => AdminConfig.findOne.mockResolvedValue(null));

  it('BUG evitado: ya no deja apuntar fechas antiguas ni fichar sin el enlace exigido', async () => {
    ClockEntry.create.mockImplementation(async (d) => d);
    const antigua = await request(buildApp()).post('/api/clock').set('Authorization', anulada())
      .send({ id: 'a1', workerName: 'Carlos', type: 'entrada', timestamp: '2026-07-01T08:00:00.000Z' });
    expect(antigua.status).toBe(400);
    const sinEnlace = await request(buildApp()).post('/api/clock').set('Authorization', anulada())
      .send({ id: 'a2', workerName: 'Carlos', type: 'entrada', timestamp: '2026-09-19T08:00:00.000Z' });
    expect(sinEnlace.status).toBe(401);
    expect(ClockEntry.create).not.toHaveBeenCalled();
    // La vigente sí.
    const vigente = await request(buildApp()).post('/api/clock').set('Authorization', `Bearer ${signToken({ role: 'admin', v: 2 })}`)
      .send({ id: 'a3', workerName: 'Carlos', type: 'entrada', timestamp: '2026-07-01T08:00:00.000Z' });
    expect(vigente.status).toBe(201);
  });

  it('BUG evitado: ya no manda a la papelera un fichaje antiguo', async () => {
    ClockEntry.findOne.mockResolvedValue({ id: 'viejo', timestamp: '2026-09-18T08:00:00.000Z' });
    const res = await request(buildApp()).delete('/api/clock/viejo').set('Authorization', anulada());
    expect(res.status).toBe(401);
    expect(ClockEntry.findOneAndUpdate).not.toHaveBeenCalled();
    const vigente = await request(buildApp()).delete('/api/clock/viejo').set('Authorization', `Bearer ${signToken({ role: 'admin', v: 2 })}`);
    expect(vigente.status).toBe(200);
  });

  it('si la base falla al comprobarla, cuenta como sin sesión (no como admin)', async () => {
    AdminConfig.findOne.mockRejectedValue(new Error('Atlas caído'));
    ClockEntry.findOne.mockResolvedValue({ id: 'viejo', timestamp: '2026-09-18T08:00:00.000Z' });
    const res = await request(buildApp()).delete('/api/clock/viejo').set('Authorization', `Bearer ${signToken({ role: 'admin', v: 2 })}`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/clock (sin id)', () => {
  it('BUG evitado: ya no se pueden borrar TODOS los fichajes de golpe, ni con sesión de admin', async () => {
    const { signToken } = await import('../utils/authToken.js');
    process.env.AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'secreto-de-test-no-real';
    ClockEntry.deleteMany = vi.fn();
    const res = await request(buildApp()).delete('/api/clock').set('Authorization', `Bearer ${signToken({ role: 'admin', v: 1 })}`);
    expect(res.status).toBe(404);
    expect(ClockEntry.deleteMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/clock — sincronización por cambios y filtro por persona', () => {
  const ordenar = (lista) => ({ sort: vi.fn().mockResolvedValue(lista) });

  it('?desde= pide a la base solo lo creado o cambiado desde esa fecha', async () => {
    ClockEntry.find.mockReturnValue(ordenar([{ id: 'n1' }]));
    const r = await request(buildApp()).get('/api/clock?desde=2026-09-28T10:00:00.000Z');
    expect(r.status).toBe(200);
    expect(r.body).toEqual([{ id: 'n1' }]);
    expect(ClockEntry.find).toHaveBeenCalledWith({ updatedAt: { $gte: new Date('2026-09-28T10:00:00.000Z') } });
  });

  it('una fecha rara da 400, sin tocar la base', async () => {
    expect((await request(buildApp()).get('/api/clock?desde=ayer')).status).toBe(400);
    expect(ClockEntry.find).not.toHaveBeenCalled();
  });

  it('BUG evitado: ?worker= se escapa antes de ir a la expresión regular (antes se podía meter un patrón)', async () => {
    ClockEntry.find.mockReturnValue(ordenar([]));
    await request(buildApp()).get(`/api/clock?worker=${encodeURIComponent('(a+)+$')}`);
    const { workerName } = ClockEntry.find.mock.calls[0][0];
    expect(workerName.source).toBe('^\\(a\\+\\)\\+\\$$');
    expect(workerName.test('(a+)+$')).toBe(true);
    expect(workerName.test('aaaa')).toBe(false);
  });

  it('BUG evitado: sin Mongo, ?worker= ya no se salta ?desde= y lo guardado lleva su marca de cambio', async () => {
    mongoose.connection.readyState = 0;
    const antes = new Date(Date.now() - 1000).toISOString();
    await request(buildApp()).post('/api/clock').send({ id: 'mem-1', workerName: 'Persona Memoria', type: 'entrada', timestamp: antes });
    await request(buildApp()).post('/api/clock').send({ id: 'mem-2', workerName: 'Otra Memoria', type: 'entrada', timestamp: antes });

    const suyos = await request(buildApp()).get(`/api/clock?desde=${antes}&worker=persona memoria`);
    expect(suyos.body.map(e => e.id)).toEqual(['mem-1']);
    expect(suyos.body[0].updatedAt).toBeTruthy();

    const futuro = new Date(Date.now() + 60 * 1000).toISOString();
    expect((await request(buildApp()).get(`/api/clock?desde=${futuro}&worker=Persona Memoria`)).body).toEqual([]);
  });
});
