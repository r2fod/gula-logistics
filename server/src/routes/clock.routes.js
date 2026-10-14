import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { ClockEntry } from '../models/ClockEntry.model.js';
import { TeamRoster } from '../models/TeamRoster.model.js';
import { AdminConfig } from '../models/AdminConfig.model.js';
import { requireAdmin, esAdminVigente, rolVigente } from '../middleware/requireAdmin.js';
import { limitePorIp } from '../middleware/limitePorIp.js';
import { verifyToken } from '../utils/authToken.js';
import { plano } from '../utils/texto.js';
import { tarifaPorDefecto, tarifasDelDocumento } from '../utils/tarifas.js';

const router = express.Router();

const DIEZ_MIN = 10 * 60 * 1000;
const limiteFichar = limitePorIp({ max: 120, ventanaMs: DIEZ_MIN });
const limiteBorrar = limitePorIp({ max: 200, ventanaMs: DIEZ_MIN });

// Un fichaje sin sesión de admin solo puede ser de hasta 45 días atrás (la cola sin
// conexión llega a tardar días, no meses) y de no más de 12 h en el futuro (un móvil
// con la hora mal). El admin sí puede apuntar fechas antiguas a mano.
const DIAS_ATRAS_MAX = 45;
const HORAS_FUTURO_MAX = 12;

// ¿Llega con el enlace personal de esa persona? (cabecera X-Enlace: el token del enlace
// ?worker=…&t=…, cuyo `w` es el id de su ficha de Saldos: "Ana Gula" → ana-gula; las
// fichas antiguas van sin el "-gula"). `exigido`: el admin ha activado que sea obligatorio.
const idDe = (nombre) => plano(nombre).replace(/\s+/g, '-');

// El enlace personal que trae la petición: `payload` si es de un trabajador y sigue
// vigente (no anulado), o null; y si el admin exige el enlace (`exigido`).
async function enlaceDe(req) {
  const payload = verifyToken(req.headers['x-enlace'] || null);
  const config = mongoose.connection.readyState === 1 ? await AdminConfig.findOne({ configKey: 'admin' }) : null;
  const vigente = payload?.role === 'trabajador' && (!config || payload.tv === (config.trabajadoresVersion || 1));
  return { payload: vigente ? payload : null, exigido: !!config?.exigirEnlaceAlFichar };
}

// ¿Es de `workerName` ese enlace? Sin tildes en los dos lados: el id de la ficha las
// conserva ("sofía-gula") y aquí se quitaban, así que el enlace de "Sofía" nunca firmaba
// (ni valía si se exige). Cuánto se parece el id del enlace al de una persona: 3 igual,
// 2 igual sin el "-gula" (fichas antiguas), 1 su nombre seguido de más ("marta" →
// "marta-lopez"), 0 nada. Y es suyo solo si a nadie más del equipo se le parece más:
// con "Ana" y "Ana Gula" en el equipo, el enlace de una valía también para la otra, y
// el de "Ana Luisa" (ana-luisa-gula) firmaba los fichajes de "Ana".
const parecido = (w, id) => (w === id ? 3 : w === id.replace(/-gula$/, '') ? 2 : w.startsWith(`${id}-`) ? 1 : 0);
function esSuEnlace(payload, workerName, equipo = []) {
  const id = idDe(workerName);
  const w = plano(payload?.w);
  if (!payload || !id || !w) return false;
  const suyo = parecido(w, id);
  return suyo > 0 && !equipo.map(o => idDe(o.name)).some((otro) => {
    if (otro === id) return false;
    const p = parecido(w, otro);
    return p > suyo || (p === suyo && otro.length > id.length);
  });
}

async function firmaDelFichaje(req, workerName, equipo = []) {
  const { payload, exigido } = await enlaceDe(req);
  return { firmado: esSuEnlace(payload, workerName, equipo), exigido };
}

// El equipo guardado y sus tarifas por defecto ([] y {} sin base o sin equipo: entonces
// no se comprueba nada con él).
async function rosterGuardado() {
  if (mongoose.connection.readyState !== 1) return { workers: [], tarifas: {} };
  const doc = await TeamRoster.findOne({ key: 'roster' });
  return { workers: doc?.workers || [], tarifas: tarifasDelDocumento(doc) };
}
const equipoGuardado = async () => (await rosterGuardado()).workers;

// Por qué no vale un fichaje que llega sin sesión, o null si vale. Sin equipo guardado
// (o sin base) no se comprueba el nombre: mejor guardar que perder un fichaje.
// `admin`: llega con una sesión de admin vigente (esAdminVigente). `persona`: quien ficha,
// de `equipo` (el guardado), si está.
function motivoParaRechazar(datos, admin, equipo, persona) {
  const momento = new Date(datos.timestamp).getTime();
  if (!datos.timestamp || Number.isNaN(momento)) return 'timestamp no es una fecha válida';
  if (admin) return null;
  const ahora = Date.now();
  if (momento > ahora + HORAS_FUTURO_MAX * 3600 * 1000) return 'La fecha del fichaje está en el futuro';
  if (momento < ahora - DIAS_ATRAS_MAX * 24 * 3600 * 1000) return 'Fichaje demasiado antiguo: lo tiene que apuntar el administrador';
  if (equipo.length && !persona) return 'Esa persona no está en el equipo';
  return null;
}

// Fallback in-memory storage when Mongo is offline
let memoryClockEntries = [];
// Lo que se guarda en memoria lleva su propia marca de cambio, como Mongo con
// `timestamps`, para que ?desde= también funcione sin base de datos.
const conMarca = (e) => ({ ...e, updatedAt: new Date().toISOString() });

// El nombre llega del navegador: se escapa antes de meterlo en una expresión
// regular (antes iba tal cual: con un patrón malicioso se podía cargar la base).
const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Qué fichajes puede leer la petición: 'todos' | 'propios' | 'ninguna'. Mientras el
// admin no exija el enlace personal, todos (como siempre: el trabajador no tiene
// sesión). Con él exigido, la dirección del servidor sola ya no enseña quién trabajó ni
// cuánto: la sesión de admin o de socias los ve todos; el enlace de un trabajador, los
// suyos (`nombres`, tal como está en el equipo); sin nada, ninguno.
async function lecturaPermitida(req) {
  const { payload, exigido } = await enlaceDe(req);
  if (!exigido || await rolVigente(req)) return { lectura: 'todos' };
  if (!payload) return { lectura: 'ninguna' };
  const equipo = await equipoGuardado();
  return { lectura: 'propios', nombres: equipo.filter(w => esSuEnlace(payload, w.name, equipo)).map(w => w.name) };
}

// GET /api/clock - Fichajes (opcional ?worker=Nombre). Con ?desde=<fecha ISO>, solo
// los creados o cambiados desde entonces (también los borrados: se marcan, no se
// quitan): la app sondea cada 20 s y así no descarga el histórico entero cada vez.
// La cabecera X-Lectura dice cuáles van (lecturaPermitida): la app la usa para no
// tomar una lista vacía por «aún no hay fichajes».
router.get('/', async (req, res) => {
  try {
    const { worker, desde } = req.query;
    const desdeFecha = desde ? new Date(String(desde)) : null;
    if (desdeFecha && Number.isNaN(desdeFecha.getTime())) {
      return res.status(400).json({ error: 'desde debe ser una fecha ISO' });
    }
    const { lectura, nombres = [] } = await lecturaPermitida(req);
    res.set('X-Lectura', lectura);
    if (lectura === 'ninguna' || (lectura === 'propios' && !nombres.length)) return res.json([]);
    const esPropio = (nombre) => nombres.some(n => plano(n) === plano(nombre));

    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (lectura === 'propios') query.workerName = { $in: nombres.map(n => new RegExp(`^${escaparRegex(n)}$`, 'i')) };
      if (worker) {
        if (lectura === 'propios' && !esPropio(worker)) return res.json([]);
        query.workerName = new RegExp(`^${escaparRegex(worker)}$`, 'i');
      }
      if (desdeFecha) query.updatedAt = { $gte: desdeFecha };
      const entries = await ClockEntry.find(query).sort({ createdAt: -1 });
      return res.json(entries);
    }

    let filtered = memoryClockEntries;
    if (lectura === 'propios') filtered = filtered.filter(e => esPropio(e.workerName));
    if (desdeFecha) filtered = filtered.filter(e => e.updatedAt && new Date(e.updatedAt) >= desdeFecha);
    if (worker) {
      filtered = filtered.filter(e => e.workerName?.toLowerCase() === String(worker).toLowerCase());
    }
    return res.json(filtered);
  } catch (error) {
    console.error('Error al obtener fichajes:', error);
    return res.status(500).json({ error: 'Error al consultar fichajes en el servidor' });
  }
});

// POST /api/clock - Add new clock entry
router.post('/', limiteFichar, async (req, res) => {
  try {
    const newEntryData = { ...req.body };
    const admin = await esAdminVigente(req);
    const { workers: equipo, tarifas } = await rosterGuardado();
    const persona = equipo.find(w => plano(w.name) === plano(newEntryData.workerName)) || null;
    const motivo = motivoParaRechazar(newEntryData, admin, equipo, persona);
    if (motivo) return res.status(400).json({ error: motivo });
    if (!newEntryData.id) {
      newEntryData.id = crypto.randomUUID();
    }

    // Este endpoint es intencionalmente público (los trabajadores fichan
    // sin login) — sin estas dos comprobaciones, cualquiera con la URL de
    // la API podía mandar un POST directo (sin pasar por la UI) con un
    // coste inventado que pairShiftsFromEntries usaría tal cual.
    // earnings/durationHours son valores CALCULADOS al emparejar turnos
    // (nunca los manda el flujo real de ClockInModal.jsx) — se descartan
    // siempre, vengan o no en la petición.
    delete newEntryData.earnings;
    delete newEntryData.durationHours;
    // Dar por bueno un turno largo es cosa del admin (PUT): fichando no se puede.
    delete newEntryData.revisado;
    // Si va firmado con su enlace lo decide el servidor, no lo que diga la petición.
    const firma = await firmaDelFichaje(req, newEntryData.workerName, equipo);
    if (firma.exigido && !firma.firmado && !admin) {
      return res.status(401).json({ error: 'Para fichar usa tu enlace personal: pídeselo al administrador.', codigo: 'ENLACE_REQUERIDO' });
    }
    newEntryData.firmado = firma.firmado;
    // rate SÍ es legítimo que lo mande el cliente (algunos fichajes usan
    // una tarifa distinta a la de por defecto, ver AdminClockEditModal),
    // pero acotado a un rango razonable — nunca 0, negativo, ni una
    // fantasía tipo 1000€/h.
    if (newEntryData.rate !== undefined) {
      const rate = Number(newEntryData.rate);
      if (!Number.isFinite(rate) || rate <= 0 || rate > 100) {
        return res.status(400).json({ error: 'rate fuera de un rango razonable (0-100€/h)' });
      }
      newEntryData.rate = rate;
    }
    // Sin sesión de admin, la tarifa y si es de nómina son las de su ficha del equipo,
    // no las que mande el móvil: con un POST directo cualquiera se ponía hasta 100 €/h.
    // Sin tarifa en la ficha, la por defecto de la base (TeamRoster.tarifas); si tampoco
    // hay, el fichaje se guarda sin tarifa (no se pierde) y se valora al leerlo con la que
    // haya entonces: nunca se inventa una en el código ni vale la que mande el móvil.
    if (!admin && persona) {
      const suya = Number(persona.rate) > 0 ? Number(persona.rate) : tarifaPorDefecto(tarifas, persona.isPayroll);
      if (suya) newEntryData.rate = suya; else delete newEntryData.rate;
      newEntryData.isPayroll = !!persona.isPayroll;
    }

    if (mongoose.connection.readyState === 1) {
      const entryDoc = await ClockEntry.create(newEntryData);
      return res.status(201).json(entryDoc);
    }

    const enMemoria = conMarca(newEntryData);
    memoryClockEntries.push(enMemoria);
    return res.status(201).json(enMemoria);
  } catch (error) {
    // id duplicado (índice único) = este fichaje YA se guardó antes — lo
    // más probable es que el móvil no recibiera la respuesta original (sin
    // cobertura) y esté reintentando el mismo POST. Sin este caso, ese
    // reintento (necesario para no perder fichajes offline, ver
    // retryPendingClockEntries en el cliente) se quedaría reintentando para
    // siempre contra un 500 genérico. Se devuelve 200 con el documento que
    // ya existe, en vez de fallar — el fichaje nunca se duplica gracias al
    // índice único de `id`, esto solo evita tratar un guardado que sí
    // funcionó como un fallo.
    if (error.code === 11000) {
      const existing = await ClockEntry.findOne({ id: req.body.id });
      if (existing) return res.status(200).json(existing);
    }
    console.error('Error al registrar fichaje:', error);
    return res.status(500).json({ error: error.message || 'Error al guardar fichaje en base de datos' });
  }
});

// PUT /api/clock/:id - Update existing clock entry (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (mongoose.connection.readyState === 1) {
      const updated = await ClockEntry.findOneAndUpdate({ id }, updateData, { new: true });
      if (!updated) return res.status(404).json({ error: 'Fichaje no encontrado' });
      return res.json(updated);
    }

    const idx = memoryClockEntries.findIndex(e => e.id === id);
    if (idx !== -1) {
      memoryClockEntries[idx] = conMarca({ ...memoryClockEntries[idx], ...updateData });
      return res.json(memoryClockEntries[idx]);
    }
    return res.status(404).json({ error: 'Fichaje no encontrado en memoria' });
  } catch (error) {
    console.error('Error al actualizar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clock/:id - Soft Delete (Admin OR Worker if < 15 mins)
router.delete('/:id', limiteBorrar, async (req, res) => {
  try {
    const { id } = req.params;
    // Una sesión de admin anulada (o un enlace viejo de socias con ella dentro) ya no
    // borra fichajes antiguos: antes bastaba con que la firma fuera buena.
    const isAdmin = await esAdminVigente(req);

    if (mongoose.connection.readyState === 1) {
      const entry = await ClockEntry.findOne({ id });
      if (!entry) return res.status(404).json({ error: 'Fichaje no encontrado' });

      // Verificación de seguridad
      const ageMs = Date.now() - new Date(entry.timestamp).getTime();
      if (!isAdmin && ageMs > 15 * 60 * 1000) {
        return res.status(401).json({ error: 'No autorizado para borrar fichajes antiguos' });
      }

      await ClockEntry.findOneAndUpdate({ id }, { deleted: true });
      return res.json({ success: true, message: 'Fichaje movido a papelera en Mongo' });
    }

    const idx = memoryClockEntries.findIndex(e => e.id === id);
    if (idx !== -1) {
      const entry = memoryClockEntries[idx];
      const ageMs = Date.now() - new Date(entry.timestamp).getTime();
      if (!isAdmin && ageMs > 15 * 60 * 1000) {
        return res.status(401).json({ error: 'No autorizado para borrar fichajes antiguos' });
      }
      memoryClockEntries[idx] = conMarca({ ...entry, deleted: true });
      return res.json({ success: true, message: 'Fichaje movido a papelera en local' });
    }
    
    return res.status(404).json({ error: 'Fichaje no encontrado' });
  } catch (error) {
    console.error('Error al borrar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/clock/:id/restore - Restore soft deleted entry (Admin only)
router.put('/:id/restore', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const updated = await ClockEntry.findOneAndUpdate({ id }, { deleted: false }, { new: true });
      if (!updated) return res.status(404).json({ error: 'Fichaje no encontrado' });
      return res.json(updated);
    }

    const idx = memoryClockEntries.findIndex(e => e.id === id);
    if (idx !== -1) {
      memoryClockEntries[idx] = conMarca({ ...memoryClockEntries[idx], deleted: false });
      return res.json(memoryClockEntries[idx]);
    }
    return res.status(404).json({ error: 'Fichaje no encontrado en memoria' });
  } catch (error) {
    console.error('Error al restaurar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// (Ya no existe DELETE /api/clock sin id: vaciaba TODOS los fichajes de golpe
// desde un botón sin confirmación. Borrar es siempre uno a uno, a la papelera.)

export default router;
