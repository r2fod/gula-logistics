import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

vi.mock('../models/LogisticsWeek.model.js', () => ({
  LogisticsWeek: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn(), deleteOne: vi.fn() },
}));
vi.mock('../models/ClockEntry.model.js', () => ({
  ClockEntry: { deleteMany: vi.fn() },
}));
vi.mock('../models/Documento.model.js', () => ({
  Documento: { create: vi.fn(), findOne: vi.fn() },
}));
// requireAdmin consulta AdminConfig para la revocación por cambio de
// contraseña; la simulamos "sin config" para que ese chequeo no interfiera
// con estos tests (ver requireAdmin.test.js para su cobertura dedicada).
vi.mock('../models/AdminConfig.model.js', () => ({
  AdminConfig: { findOne: vi.fn().mockResolvedValue(null) },
}));

const { LogisticsWeek } = await import('../models/LogisticsWeek.model.js');
const { ClockEntry } = await import('../models/ClockEntry.model.js');
const { Documento } = await import('../models/Documento.model.js');
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

  it('BUG evitado: guardar una semana que YA existe sin updatedAt da 409 y no sobrescribe (antes pisaba lo de otro sin avisar)', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', updatedAt: '2026-09-20T10:00:00.000Z' });
    const res = await request(buildApp())
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({ week_3: { weekId: 'week_3', name: 'Semana 3 (copia vieja)', schedule: {} } });

    expect(res.status).toBe(409);
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
  it('BUG evitado: devuelve SOLO las semanas guardadas, no la caché en memoria con versiones viejas de otras', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null);
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_9', name: 'Semana 9' });
    const res = await request(buildApp())
      .post('/api/logistics/weeks')
      .set('Authorization', adminAuthHeader())
      .send({ week_9: { weekId: 'week_9', name: 'Semana 9', schedule: {} } });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data)).toEqual(['week_9']);
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
      expect.objectContaining({ weekId: 'week_3' }),
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
      sundayMonday: { tasks: [{ text: 'Devolver Alquileres Norte' }, 'texto plano'] },
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
      sundayMonday: { tasks: [{ text: 'Devolver Alquileres Norte', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    const app = buildApp();

    // Tarea que solo "se veía" hecha por la hora (completed false): desmarcarla debe persistir reopened.
    const r1 = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: false, reopened: true });
    expect(r1.status).toBe(200);
    expect(r1.body.unchanged).toBeUndefined();
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'week_3' }),
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Alquileres Norte', completed: false, reopened: true } } },
      { new: true }
    );

    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', sundayMonday: { tasks: [{ text: 'Devolver Alquileres Norte', completed: false, reopened: true }] } });
    LogisticsWeek.findOneAndUpdate.mockClear();
    const r2 = await request(app).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'domingo', taskIndex: 0, completed: true, reopened: false });
    expect(r2.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'week_3' }),
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Alquileres Norte', completed: true, reopened: false } } },
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
      expect.objectContaining({ weekId: 'week_3' }),
      { $set: { 'sundayMonday.tasks.0': { text: 'X', completed: true, reopened: true, assigned: ['Ana'] } } },
      { new: true }
    );
  });

  it('resuelve "domingo" contra sundayMonday.tasks, no schedule.domingo', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      sundayMonday: { tasks: [{ text: 'Devolver Alquileres Norte', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'domingo', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'week_3' }),
      { $set: { 'sundayMonday.tasks.0': { text: 'Devolver Alquileres Norte', completed: true } } },
      { new: true }
    );
  });

  it('resuelve "sabado" contra saturdaySpecial.weddings, no schedule.sabado (que ni existe)', async () => {
    LogisticsWeek.findOne.mockResolvedValue({
      weekId: 'week_3',
      saturdaySpecial: { weddings: [{ location: 'Finca Este', truck: 'Camión Gula', completed: false }] },
    });
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });

    const app = buildApp();
    const res = await request(app)
      .patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'sabado', taskIndex: 0, completed: true });

    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'week_3' }),
      { $set: { 'saturdaySpecial.weddings.0': { location: 'Finca Este', truck: 'Camión Gula', completed: true } } },
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
      expect.objectContaining({ weekId: 'week_3' }),
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

  describe('BUG evitado: la marca llega tarde (cola sin cobertura) y el admin reordenó el día', () => {
    const semana = (tasks) => ({ weekId: 'week_3', schedule: { martes: { tasks } }, saturdaySpecial: { weddings: [{ location: 'Finca', truck: 'C1' }] } });
    const marcar = (cuerpo) => request(buildApp()).patch('/api/logistics/weeks/week_3/tasks').send({ completed: true, ...cuerpo });
    const marcada = () => Object.keys(LogisticsWeek.findOneAndUpdate.mock.calls[0][1].$set)[0];
    beforeEach(() => LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' }));

    it('con su id, se marca ESA tarea aunque ya esté en otra posición (antes, la que ocupaba su sitio)', async () => {
      LogisticsWeek.findOne.mockResolvedValue(semana([{ id: 'm9', text: 'Nueva' }, { id: 'm1', text: 'Cargar' }]));
      expect((await marcar({ dayKey: 'martes', taskIndex: 0, taskId: 'm1', taskText: 'Cargar' })).status).toBe(200);
      expect(marcada()).toBe('schedule.martes.tasks.1');
    });

    it('sin id, por su texto; si ya no está, 404 y no se marca ninguna', async () => {
      LogisticsWeek.findOne.mockResolvedValue(semana(['Nueva', { text: 'Cargar' }]));
      expect((await marcar({ dayKey: 'martes', taskIndex: 0, taskText: 'Cargar' })).status).toBe(200);
      expect(marcada()).toBe('schedule.martes.tasks.1');
      LogisticsWeek.findOneAndUpdate.mockClear();
      expect((await marcar({ dayKey: 'martes', taskIndex: 0, taskText: 'Descargar' })).status).toBe(404);
      expect((await marcar({ dayKey: 'martes', taskIndex: 0, taskId: 'm7', taskText: 'Nueva' })).status).toBe(404);
      expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('una boda del sábado (sin texto propio) sigue yendo por su posición; textos enormes, 400', async () => {
      LogisticsWeek.findOne.mockResolvedValue(semana([]));
      expect((await marcar({ dayKey: 'sabado', taskIndex: 0, taskText: 'Boda Finca · C1' })).status).toBe(200);
      expect(marcada()).toBe('saturdaySpecial.weddings.0');
      expect((await marcar({ dayKey: 'sabado', taskIndex: 0, taskText: 'x'.repeat(501) })).status).toBe(400);
      expect((await marcar({ dayKey: 'sabado', taskIndex: 0, taskId: { $ne: null } })).status).toBe(400);
    });
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

describe('PATCH tareas — sin pisar un guardado del admin (versión) y con límites', () => {
  const semanaCon = (updatedAt) => ({
    weekId: 'week_3', updatedAt,
    schedule: { martes: { tasks: [{ text: 'Cargar furgoneta', completed: false, assigned: ['Ana'] }] } },
  });
  const marcar = () => request(buildApp()).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'martes', taskIndex: 0, completed: true });

  it('BUG evitado: escribe solo si la semana sigue en la versión que leyó (filtra por updatedAt)', async () => {
    LogisticsWeek.findOne.mockResolvedValue(semanaCon('2026-11-01T10:00:00.000Z'));
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    await marcar();
    const [filtro] = LogisticsWeek.findOneAndUpdate.mock.calls[0];
    expect(filtro).toEqual(expect.objectContaining({ weekId: 'week_3', updatedAt: '2026-11-01T10:00:00.000Z' }));
  });

  it('BUG evitado: si el admin guardó entre la lectura y la escritura, relee y repite una vez con la versión nueva', async () => {
    LogisticsWeek.findOne
      .mockResolvedValueOnce(semanaCon('2026-11-01T10:00:00.000Z'))
      .mockResolvedValueOnce(semanaCon('2026-11-01T10:00:05.000Z'));
    LogisticsWeek.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({ weekId: 'week_3' });
    const res = await marcar();
    expect(res.status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(LogisticsWeek.findOneAndUpdate.mock.calls[1][0]).toEqual(expect.objectContaining({ updatedAt: '2026-11-01T10:00:05.000Z' }));
  });

  it('si la semana sigue cambiando tras el reintento, responde 409 y no pisa nada más', async () => {
    LogisticsWeek.findOne.mockResolvedValue(semanaCon('2026-11-01T10:00:00.000Z'));
    LogisticsWeek.findOneAndUpdate.mockResolvedValue(null);
    const res = await marcar();
    expect(res.status).toBe(409);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('rechaza un día que no existe (400) sin leer la base', async () => {
    const res = await request(buildApp()).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: '__proto__', taskIndex: 0, completed: true });
    expect(res.status).toBe(400);
    expect(LogisticsWeek.findOne).not.toHaveBeenCalled();
  });

  it('rechaza un cuerpo enorme (413) antes de tocar la base', async () => {
    const res = await request(buildApp()).patch('/api/logistics/weeks/week_3/tasks')
      .send({ dayKey: 'martes', taskIndex: 0, completed: true, taskText: 'x'.repeat(20000) });
    expect(res.status).toBe(413);
    expect(LogisticsWeek.findOne).not.toHaveBeenCalled();
  });
});

describe('PATCH — completedAt (endpoint público)', () => {
  const tarea = () => LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', schedule: { martes: { tasks: [{ text: 'Cargar', completed: false }] } } });
  const enviar = (body) => request(buildApp()).patch('/api/logistics/weeks/week_3/tasks').send({ dayKey: 'martes', taskIndex: 0, completed: true, ...body });

  it('guarda la hora real si es una fecha ISO', async () => {
    tarea();
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_3' });
    const hora = '2026-09-27T10:05:00.000Z';
    expect((await enviar({ completedAt: hora })).status).toBe(200);
    expect(LogisticsWeek.findOneAndUpdate.mock.calls[0][1].$set['schedule.martes.tasks.0']).toEqual({ text: 'Cargar', completed: true, completedAt: hora });
  });

  it('BUG evitado: rechaza objetos, números o textos que no son fechas (antes se guardaban tal cual)', async () => {
    tarea();
    for (const completedAt of [{ $gt: '' }, 123, 'no es fecha', 'x'.repeat(500)]) {
      expect((await enviar({ completedAt })).status).toBe(400);
    }
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('marcar una tarea ya hecha no la reescribe (conserva la hora de la primera vez)', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', schedule: { martes: { tasks: [{ text: 'Cargar', completed: true, completedAt: '2026-09-27T08:00:00.000Z' }] } } });
    const r = await enviar({ completedAt: '2026-09-27T10:00:00.000Z' });
    expect(r.body.unchanged).toBe(true);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('Gestión de semanas', () => {
  const version = '2026-09-20T09:00:00.000Z';
  const publicada = { weekId: 'week_x', name: 'Semana 4', updatedAt: version, meta: { status: 'Operativa Activa' } };
  const otra = { weekId: 'week_y', name: 'Semana 5', updatedAt: version, meta: { status: 'Borrador' } };
  const url = '/api/logistics/weeks/week_x';
  const conAdmin = (peticion) => peticion.set('Authorization', adminAuthHeader());
  const archivar = () => conAdmin(request(buildApp()).delete(url)).send({ updatedAt: version });

  beforeEach(() => {
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(fn => fn({}));
    vi.spyOn(mongoose.connection, 'collection').mockReturnValue({ updateOne: vi.fn().mockResolvedValue({}) });
    LogisticsWeek.find.mockResolvedValue([publicada, otra]);
    LogisticsWeek.findOne.mockResolvedValue(publicada);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    LogisticsWeek.find.mockReset();
    LogisticsWeek.findOne.mockReset();
  });

  it('renombrar y eliminar exigen admin', async () => {
    expect((await request(buildApp()).patch(url).send({ name: 'Semana 5', updatedAt: version })).status).toBe(401);
    expect((await request(buildApp()).delete(url).send({ updatedAt: version })).status).toBe(401);
  });

  it('renombra una publicada y desplaza un borrador, conservando sus fechas y tareas', async () => {
    LogisticsWeek.findOneAndUpdate.mockImplementation(async ({ weekId }, { $set }) => {
      const anterior = [publicada, otra].find(w => w.weekId === weekId);
      return { ...anterior, name: $set.name, meta: { ...anterior.meta, week: $set['meta.week'] } };
    });
    const r = await conAdmin(request(buildApp()).patch(url)).send({ name: ' Semana 5 ', updatedAt: version, schedule: {}, meta: { status: 'Borrador' } });
    expect(r.status).toBe(200);
    expect(r.body.data.week_x).toMatchObject({ name: 'Semana 5', meta: { week: 'Semana 5', status: 'Operativa Activa' } });
    expect(r.body.data.week_y).toMatchObject({ name: 'Semana 6', meta: { week: 'Semana 6', status: 'Borrador' } });
    expect(LogisticsWeek.findOneAndUpdate.mock.calls.map(([, update]) => update.$set)).toEqual([
      { name: 'Semana 5', 'meta.week': 'Semana 5' }, { name: 'Semana 6', 'meta.week': 'Semana 6' },
    ]);
    LogisticsWeek.findOneAndUpdate.mockReset();
  });

  it('al crear manualmente conserva el número elegido y desplaza la semana previa', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null);
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ ...publicada, name: 'Semana 5' });
    const creada = { weekId: 'week_nueva', name: 'Semana 4', meta: { status: 'Operativa Activa', week: 'Semana 4' } };
    LogisticsWeek.create.mockResolvedValue([creada]);
    const r = await conAdmin(request(buildApp()).post('/api/logistics/weeks/manual'))
      .send({ weekId: 'week_nueva', week: { name: '4', updatedAt: version } });
    expect(r.status).toBe(201);
    expect(r.body.data.week_nueva).toEqual(creada);
    expect(LogisticsWeek.findOneAndUpdate.mock.calls.map(([, update]) => update.$set.name)).toEqual(['Semana 5', 'Semana 6']);
    expect(LogisticsWeek.create.mock.calls[0][0][0].updatedAt).toBeUndefined();
  });

  it('el histórico archivado solo está disponible con acceso al panel', async () => {
    expect((await request(buildApp()).get('/api/logistics/weeks/archivadas')).status).toBe(401);
    LogisticsWeek.find.mockResolvedValue([{ ...publicada, archivada: true }]);
    const r = await conAdmin(request(buildApp()).get('/api/logistics/weeks/archivadas'));
    expect(r.body.week_x).toMatchObject({ archivada: true });
    expect(LogisticsWeek.find).toHaveBeenCalledWith({ archivada: true, 'meta.status': { $ne: 'Borrador' } });
  });

  it('archiva una publicada conservando el documento', async () => {
    LogisticsWeek.find.mockResolvedValue([publicada, { ...otra, meta: { status: 'Operativa Activa' } }]);
    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ ...publicada, archivada: true });
    const r = await archivar();
    expect(r.status).toBe(200);
    expect(r.body.success).toBe(true);
    expect(LogisticsWeek.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ weekId: 'week_x', updatedAt: new Date(version) }),
      { $set: { archivada: true, archivadaEn: expect.any(Date) } },
      expect.objectContaining({ new: true })
    );
    expect(LogisticsWeek.deleteOne).not.toHaveBeenCalled();
  });

  it('impide archivar la última publicada aunque haya borradores', async () => {
    expect((await archivar()).status).toBe(409);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rechaza la versión desactualizada antes de renombrar o archivar', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ ...publicada, updatedAt: '2026-09-20T10:00:00.000Z' });
    expect((await conAdmin(request(buildApp()).patch(url)).send({ name: 'Semana 5', updatedAt: version })).status).toBe(409);
    expect((await archivar()).status).toBe(409);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('GET /api/logistics/weeks', () => {
  it('BUG evitado: con base configurada, si la consulta falla responde 503 y no la semana de ejemplo (la app la tomaba por todas)', async () => {
    process.env.MONGODB_URI = 'mongodb://de-test-no-real';
    LogisticsWeek.find.mockRejectedValue(new Error('conexión cortada'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(buildApp()).get('/api/logistics/weeks');
      expect(res.status).toBe(503);
      expect(res.body.week_3).toBeUndefined();
    } finally {
      delete process.env.MONGODB_URI;
    }
  });
});

describe('Rutas antiguas retiradas', () => {
  it('GET /api/logistics y POST /update ya no existen (nadie las usaba)', async () => {
    const app = buildApp();
    expect((await request(app).get('/api/logistics')).status).toBe(404);
    expect((await request(app).post('/api/logistics/update').send({ foo: 'bar' })).status).toBe(404);
  });
});

describe('POST /api/logistics/weeks/draft (borradores automáticos: nunca pisan nada)', () => {
  const borrador = () => ({ name: 'Semana 5', meta: { week: 'Semana 5', status: 'Borrador' }, schedule: {} });
  const enviar = (body, token = adminAuthHeader()) => request(buildApp()).post('/api/logistics/weeks/draft').set('Authorization', token).send(body);
  beforeEach(() => {
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation(fn => fn({}));
    vi.spyOn(mongoose.connection, 'collection').mockReturnValue({ updateOne: vi.fn().mockResolvedValue({}) });
    LogisticsWeek.find.mockResolvedValue([{ weekId: 'week_3', name: 'Semana 4' }]);
  });
  afterEach(() => vi.restoreAllMocks());

  it('exige admin', async () => {
    expect((await request(buildApp()).post('/api/logistics/weeks/draft').send({ weekId: 'week_x', week: borrador() })).status).toBe(401);
  });

  it('crea la semana si no existe (201)', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null);
    LogisticsWeek.create.mockResolvedValue([{ weekId: 'week_auto_2026-09-29', name: 'Semana 5' }]);
    const r = await enviar({ weekId: 'week_auto_2026-09-29', week: borrador() });
    expect(r.status).toBe(201);
    expect(LogisticsWeek.create).toHaveBeenCalledWith([expect.objectContaining({ weekId: 'week_auto_2026-09-29', id: 'week_auto_2026-09-29', name: 'Semana 5' })], expect.anything());
  });

  it('BUG evitado: si ya existe NO la pisa (409), aunque no sea borrador', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_3', meta: { status: 'Operativa Activa' } });
    const r = await enviar({ weekId: 'week_3', week: borrador(), reemplazar: true });
    expect(r.status).toBe(409);
    expect(r.body.borrador).toBe(false);
    expect(LogisticsWeek.create).not.toHaveBeenCalled();
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('no vuelve a crear un borrador automático eliminado', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_auto_1', archivada: true, meta: { status: 'Borrador' } });
    expect((await enviar({ weekId: 'week_auto_1', week: borrador(), reemplazar: true })).status).toBe(409);
    expect(LogisticsWeek.create).not.toHaveBeenCalled();
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('un borrador existente solo se reemplaza con reemplazar:true', async () => {
    LogisticsWeek.findOne.mockResolvedValue({ weekId: 'week_auto_1', meta: { status: 'Borrador' } });
    const sin = await enviar({ weekId: 'week_auto_1', week: borrador() });
    expect(sin.status).toBe(409);
    expect(sin.body.borrador).toBe(true);
    expect(LogisticsWeek.findOneAndUpdate).not.toHaveBeenCalled();

    LogisticsWeek.findOneAndUpdate.mockResolvedValue({ weekId: 'week_auto_1' });
    const con = await enviar({ weekId: 'week_auto_1', week: borrador(), reemplazar: true });
    expect(con.status).toBe(200);
    expect(con.body.reemplazada).toBe(true);
  });

  it('dos sesiones a la vez: el índice único devuelve 409 en vez de duplicar', async () => {
    LogisticsWeek.findOne.mockResolvedValue(null);
    LogisticsWeek.create.mockRejectedValue(Object.assign(new Error('E11000 duplicate key'), { code: 11000 }));
    expect((await enviar({ weekId: 'week_auto_2', week: borrador() })).status).toBe(409);
  });

  it('rechaza weekId raro y semanas que no son borrador', async () => {
    expect((await enviar({ weekId: '../x', week: borrador() })).status).toBe(400);
    expect((await enviar({ weekId: 'week_ok', week: { name: 'X', meta: { status: 'Operativa Activa' } } })).status).toBe(400);
    expect((await enviar({ weekId: 'week_ok' })).status).toBe(400);
    expect(LogisticsWeek.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/logistics/optimize (vaciar la papelera de fichajes)', () => {
  it('borra solo los fichajes de la papelera y dice cuántos', async () => {
    ClockEntry.deleteMany.mockResolvedValue({ deletedCount: 3 });
    const res = await request(buildApp()).post('/api/logistics/optimize').set('Authorization', adminAuthHeader());
    expect(ClockEntry.deleteMany).toHaveBeenCalledWith({ deleted: true });
    expect(res.body).toMatchObject({ success: true, borrados: 3 });
  });

  it('BUG evitado: sin Mongo ya no dice que ha vaciado nada (503)', async () => {
    mongoose.connection.readyState = 0;
    const res = await request(buildApp()).post('/api/logistics/optimize').set('Authorization', adminAuthHeader());
    expect(res.status).toBe(503);
    expect(ClockEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('sin sesión de admin, 401', async () => {
    const res = await request(buildApp()).post('/api/logistics/optimize');
    expect(res.status).toBe(401);
  });
});

describe('PDF del alquiler de un camión (upload-rental y documentos)', () => {
  const PDF = Buffer.from('%PDF-1.4 contrato de prueba');
  const subir = (contenido, nombre = 'contrato.pdf', tipo = 'application/pdf') => request(buildApp())
    .post('/api/logistics/upload-rental')
    .set('Authorization', adminAuthHeader())
    .attach('file', contenido, { filename: nombre, contentType: tipo });

  it('BUG evitado: el PDF se guarda en la base, no en el disco de Render (que se borra al dormirse)', async () => {
    Documento.create.mockImplementation(async (d) => d);
    const res = await subir(PDF);
    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^\/api\/logistics\/documentos\/[a-f0-9]{32}$/);
    expect(Documento.create.mock.calls[0][0].nombre).toBe('contrato.pdf'); // solo en la base: la semana es pública
    const guardado = Documento.create.mock.calls[0][0];
    expect(guardado.clave).toBe(res.body.url.split('/').pop());
    expect(Buffer.compare(guardado.datos, PDF)).toBe(0);
  });

  it('BUG evitado: un archivo que dice ser PDF pero no lo es (p. ej. una web) se rechaza', async () => {
    const res = await subir(Buffer.from('<script>alert(1)</script>'), 'contrato.html');
    expect(res.status).toBe(400);
    expect(Documento.create).not.toHaveBeenCalled();
  });

  it('lo que no se declara PDF se rechaza con 400', async () => {
    expect((await subir(Buffer.from('hola'), 'nota.txt', 'text/plain')).status).toBe(400);
  });

  it('el PDF solo lo da con sesión de admin (la semana es pública y lleva la dirección)', async () => {
    const clave = 'a'.repeat(32);
    Documento.findOne.mockResolvedValue({ clave, datos: PDF });
    expect((await request(buildApp()).get(`/api/logistics/documentos/${clave}`)).status).toBe(401);
    expect(Documento.findOne).not.toHaveBeenCalled();
    const res = await request(buildApp()).get(`/api/logistics/documentos/${clave}`).set('Authorization', adminAuthHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.compare(res.body, PDF)).toBe(0);
    expect(Documento.findOne).toHaveBeenCalledWith({ clave });
  });

  it('una clave rara o que no existe da 404 (sin consultas raras a la base)', async () => {
    Documento.findOne.mockResolvedValue(null);
    const auth = { Authorization: adminAuthHeader() };
    expect((await request(buildApp()).get('/api/logistics/documentos/' + 'b'.repeat(32)).set(auth)).status).toBe(404);
    expect((await request(buildApp()).get('/api/logistics/documentos/..%2Fsecreto').set(auth)).status).toBe(404);
    expect(Documento.findOne).toHaveBeenCalledTimes(1);
  });

  it('sin base (en local) se guarda en memoria y se puede abrir', async () => {
    mongoose.connection.readyState = 0;
    const { body } = await subir(PDF);
    const res = await request(buildApp()).get(body.url).set('Authorization', adminAuthHeader());
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body, PDF)).toBe(0);
    expect(Documento.create).not.toHaveBeenCalled();
  });
});
