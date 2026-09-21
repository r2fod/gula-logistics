import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/LogisticsWeek.model.js', () => ({
  LogisticsWeek: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
}));
vi.mock('../models/Logistics.model.js', () => ({
  Logistics: { findOne: vi.fn(), create: vi.fn() },
}));
// requireAdmin consulta AdminConfig para la revocación por cambio de
// contraseña; la simulamos "sin config" para que ese chequeo no interfiera
// con estos tests (ver requireAdmin.test.js para su cobertura dedicada).
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { LogisticsWeek } = await import('../models/LogisticsWeek.model.js');
const logisticsRoutes = (await import('./logistics.routes.js')).default;
const { signToken } = await import('../utils/authToken.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/logistics', logisticsRoutes);
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

describe('POST /api/logistics/weeks (reemplazo de documento completo)', () => {
  it('rechaza sin token de admin — antes de este fix cualquiera podía sobrescribir el planning', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/logistics/weeks')
      .send({ week_3: { weekId: 'week_3', name: 'Semana 3', schedule: {} } });

    expect(res.status).toBe(401);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('permite guardar la semana completa con un token de admin válido', async () => {
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({ week_3: { weekId: 'week_3', name: 'Semana 3', schedule: {} } });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      expect.objectContaining({ weekId: 'week_3' }),
      expect.objectContaining({ upsert: true })
    );
  });

  it('semana nueva sin updatedAt previo: guarda sin comprobar conflicto (nada que comparar)', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null); // no existe todavía
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_4' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({ week_4: { weekId: 'week_4', name: 'Semana 4', schedule: {} } });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalled();
  });

  it('guardado concurrente: si el updatedAt que manda el cliente ya no coincide con el actual, rechaza con 409 y NO sobrescribe', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      updatedAt: '2026-09-20T10:00:00.000Z', // alguien más lo guardó después de que este cliente abriera la semana
    });
    const app = buildApp();
    const res = await request(app)
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({
        week_3: {
          weekId: 'week_3',
          name: 'Semana 3 (mi edición)',
          schedule: {},
          updatedAt: '2026-09-20T09:00:00.000Z', // la versión con la que este cliente abrió la semana
        },
      });

    expect(res.status).toBe(409);
    expect(res.body.conflict).toBe(true);
    expect(res.body.conflicts).toEqual(['week_3']);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('guardado normal: si el updatedAt coincide con el actual, sí guarda', async () => {
    const sameUpdatedAt = '2026-09-20T09:00:00.000Z';
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', updatedAt: sameUpdatedAt });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3', updatedAt: '2026-09-20T09:05:00.000Z' });
    const app = buildApp();
    const res = await request(app)
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({ week_3: { weekId: 'week_3', name: 'Semana 3', schedule: {}, updatedAt: sameUpdatedAt } });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalled();
  });
});

describe('PATCH /api/logistics/weeks/:weekId/tasks (marcar UNA tarea)', () => {
  it('funciona SIN token — es lo que necesita el trabajador al fichar salida', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      schedule: { martes: { tasks: [{ text: 'Cargar furgoneta', completed: false }] } },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'schedule.martes.tasks.0': { text: 'Cargar furgoneta', completed: true } } },
      { new: true }
    );
  });

  it('BUG evitado: repetir el mismo PATCH (tarea ya en ese estado) NO escribe ni sube updatedAt', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      schedule: { martes: { tasks: [{ text: 'Cargar furgoneta', completed: true }] } },
    });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, unchanged: true });
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('desmarcar una tarea que ya estaba sin marcar tampoco escribe', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      sundayMonday: { tasks: [{ text: 'Devolver Dealde' }, 'texto plano'] },
    });

    const app = buildApp();
    for (const taskIndex of [0, 1]) {
      const res = await request(app)
        .patch('/api/logistics/weeks/week_3/tasks')
        .send({ dayKey: 'domingo', taskIndex, completed: false });
      expect(res.body.unchanged).toBe(true);
    }
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('desmarcar a propósito guarda reopened:true (el reloj ya no la vuelve a marcar) y marcar lo quita', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      sundayMonday: { tasks: [{ text: 'Devolver Dealde', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    const app = buildApp();

    // Tarea que solo "se veía" hecha por la hora (completed false): desmarcarla debe persistir reopened.
    const r1 = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: false, reopened: true });
    expect(r1.status).toBe(200);
    expect(r1.body.unchanged).toBeUndefined();
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Dealde', completed: false, reopened: true } } },
      { new: true }
    );

    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', sundayMonday: { tasks: [{ text: 'Devolver Dealde', completed: false, reopened: true }] } });
    LogisticsWeek.findOneAndUpdate.mockClear();
    const r2 = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: true, reopened: false });
    expect(r2.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Dealde', completed: true, reopened: false } } },
      { new: true }
    );
  });

  it('repetir el mismo desmarcado (ya con reopened) no escribe; reopened no booleano se rechaza; el resto de campos no se toca', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      sundayMonday: { tasks: [{ text: 'X', completed: false, reopened: true, assigned: ['Ana'] }] },
    });
    const app = buildApp();
    const igual = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: false, reopened: true });
    expect(igual.body.unchanged).toBe(true);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();

    const malo = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: false, reopened: 'si' });
    expect(malo.status).toBe(400);

    // sin reopened en el cuerpo, un completed distinto sigue escribiendo solo completed y conserva lo demás
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: true });
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'sundayMonday.tasks.0': { text: 'X', completed: true, reopened: true, assigned: ['Ana'] } } },
      { new: true }
    );
  });

  it('resuelve "domingo" contra sundayMonday.tasks, no schedule.domingo', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      sundayMonday: { tasks: [{ text: 'Devolver Dealde', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'domingo', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Dealde', completed: true } } },
      { new: true }
    );
  });

  it('resuelve "sabado" contra saturdaySpecial.weddings, no schedule.sabado (que ni existe)', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      saturdaySpecial: { weddings: [{ location: 'Sot de Chera', truck: 'Camión Gula', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'sabado', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'saturdaySpecial.weddings.0': { location: 'Sot de Chera', truck: 'Camión Gula', completed: true } } },
      { new: true }
    );
  });

  it('convierte una tarea guardada como texto plano al formato objeto al completarla', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      schedule: { martes: { tasks: ['Recoger sillas'] } },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });

    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      { weekId: 'week_3' },
      { $set: { 'schedule.martes.tasks.0': { text: 'Recoger sillas', completed: true } } },
      { new: true }
    );
  });

  it('nunca escribe otros campos de la semana (solo la ruta de esa tarea)', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      trucks: ['Camión Gula'],
      schedule: { martes: { tasks: [{ text: 'Cargar furgoneta', completed: false }] } },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });

    const [, updatePayload] = LogisticsWeek.findOneAndUpdate.mock.calls[0];
    expect(Object.keys(updatePayload.$set)).toEqual(['schedule.martes.tasks.0']);
    expect(updatePayload).not.toHaveProperty('trucks');
  });

  it('rechaza payloads con tipos inválidos (400) sin tocar la base de datos', async () => {
    const app = buildApp();

    const resNoDay = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ taskIndex: 0, completed: true });
    expect(resNoDay.status).toBe(400);

    const resBadIndex = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'martes', taskIndex: -1, completed: true });
    expect(resBadIndex.status).toBe(400);

    const resBadCompleted = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'martes', taskIndex: 0, completed: 'si' });
    expect(resBadCompleted.status).toBe(400);

    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la semana no existe', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null);
    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_inexistente/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });
    expect(res.status).toBe(404);
  });

  it('devuelve 404 si el índice de tarea no existe en ese día', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', schedule: { martes: { tasks: [] } } });
    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/logistics/update (legacy)', () => {
  it('ahora también requiere admin', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/logistics/update').send({ foo: 'bar' });
    expect(res.status).toBe(401);
  });
});
