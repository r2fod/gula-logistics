import mongoose from 'mongoose';
import { LogisticsWeek } from '../models/LogisticsWeek.model.js';
import { cambiosDeNumeracion, siguienteNumero, normalizarNombreSemana } from './numeracionSemanas.js';

export const semanasVisibles = { archivada: { $ne: true } };
const mensajeConflicto = 'La semana ha cambiado. Cierra esta ventana y vuelve a abrirla antes de repetir el cambio.';
const fallo = (status, message, extra = {}) => ({ status, success: false, message, ...extra });
const visibles = (session) => LogisticsWeek.find(semanasVisibles, null, { session });

export const nombreValido = (name) => typeof name === 'string' && name.trim().length > 0 && normalizarNombreSemana(name).length <= 120;
export const idValido = (id) => typeof id === 'string' && /^week_[A-Za-z0-9_-]{1,60}$/.test(id);

// El primer write de la transacción es común a todas las operaciones de
// numeración: también se serializan dos creaciones que eligen un número libre.
async function conNumeracion(operacion) {
  if (mongoose.connection.readyState !== 1) return fallo(503, 'No se pudo conectar con la base de datos.');
  const control = mongoose.connection.collection('control_semanas');
  const clave = { _id: 'numeracion' };
  try {
    await control.updateOne(clave, { $setOnInsert: { revision: 0 } }, { upsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error; // otra petición inicializó el control
  }
  return mongoose.connection.transaction(async (session) => {
    await control.updateOne(clave, { $inc: { revision: 1 } }, { session });
    return operacion(session);
  });
}

async function guardarNombres(semanas, weekId, name, session, nueva = false) {
  const anteriores = new Map(semanas.map(s => [s.weekId, s]));
  const data = {};
  for (const [id, nombre] of cambiosDeNumeracion(semanas, weekId, name)) {
    if (nueva && id === weekId) continue;
    const anterior = anteriores.get(id);
    data[id] = anterior.name === nombre && anterior.meta?.week === nombre ? anterior
      : await LogisticsWeek.findOneAndUpdate({ weekId: id, ...semanasVisibles },
        { $set: { name: nombre, 'meta.week': nombre } }, { session, new: true });
  }
  return data;
}

export function crearSemanaManual(weekId, week) {
  if (!idValido(weekId) || !nombreValido(week?.name)) return fallo(400, 'El nombre de la semana debe tener entre 1 y 120 caracteres.');
  return conNumeracion(async session => {
    const previa = await LogisticsWeek.findOne({ weekId }, null, { session });
    if (previa) return fallo(409, 'Ya existe una semana con ese identificador.');
    const name = normalizarNombreSemana(week.name);
    const data = await guardarNombres(await visibles(session), weekId, name, session, true);
    const { _id, createdAt, updatedAt, archivadaEn, __v, ...contenido } = week;
    const [creada] = await LogisticsWeek.create([{
      ...contenido, weekId, id: weekId, name, archivada: false,
      meta: { ...week.meta, week: name, status: 'Operativa Activa' },
    }], { session });
    return { status: 201, success: true, data: { ...data, [weekId]: creada } };
  });
}

export function crearBorrador(weekId, week, reemplazar) {
  return conNumeracion(async session => {
    const existing = await LogisticsWeek.findOne({ weekId }, null, { session });
    if (existing && (existing.archivada || !reemplazar || existing.meta?.status !== 'Borrador')) {
      const borrador = !existing.archivada && existing.meta?.status === 'Borrador';
      return fallo(409, borrador ? 'Esa semana ya existe como borrador (usa reemplazar para regenerarla)'
        : 'Esa semana ya existe o fue eliminada: no se toca', { existe: true, borrador });
    }
    if (existing) {
      const actualizado = await LogisticsWeek.findOneAndUpdate({ weekId, ...semanasVisibles, 'meta.status': 'Borrador' },
        { ...week, weekId, id: weekId, name: existing.name, archivada: false, meta: { ...week.meta, week: existing.name } },
        { session, new: true });
      return { status: 200, success: true, reemplazada: true, data: actualizado };
    }
    const name = siguienteNumero(await visibles(session));
    const [creada] = await LogisticsWeek.create([{
      ...week, weekId, id: weekId, name, archivada: false, meta: { ...week.meta, week: name },
    }], { session });
    return { status: 201, success: true, creada: true, data: creada };
  });
}

export function gestionarSemana(weekId, version, accion, name) {
  if (!idValido(weekId)) return fallo(404, 'Semana no encontrada.');
  if (accion === 'renombrar' && !nombreValido(name)) return fallo(400, 'El nombre de la semana debe tener entre 1 y 120 caracteres.');
  if (typeof version !== 'string' || !Number.isFinite(Date.parse(version))) return fallo(409, mensajeConflicto);
  const updatedAt = new Date(version);
  return conNumeracion(async session => {
    const semana = await LogisticsWeek.findOne({ weekId, ...semanasVisibles }, null, { session });
    if (!semana) return fallo(404, 'Semana no encontrada.');
    if (new Date(semana.updatedAt).getTime() !== updatedAt.getTime()) return fallo(409, mensajeConflicto);
    const semanas = await visibles(session);
    if (accion === 'renombrar') {
      const data = await guardarNombres(semanas, weekId, normalizarNombreSemana(name), session);
      return { status: 200, success: true, data };
    }
    if (semanas.length <= 1 || (semana.meta?.status !== 'Borrador' &&
      !semanas.some(s => s.weekId !== weekId && s.meta?.status !== 'Borrador'))) {
      return fallo(409, 'Debe quedar al menos una semana publicada en el planning.');
    }
    const archivada = await LogisticsWeek.findOneAndUpdate({ weekId, updatedAt, ...semanasVisibles },
      { $set: { archivada: true, archivadaEn: new Date() } }, { session, new: true });
    return archivada ? { status: 200, success: true } : fallo(409, mensajeConflicto);
  });
}
