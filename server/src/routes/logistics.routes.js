import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
import { Logistics } from '../models/Logistics.model.js';
import { LogisticsWeek } from '../models/LogisticsWeek.model.js';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/requireAdmin.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar multer
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'rental-' + uniqueSuffix + path.extname(file.originalname));
  }
});
// Solo PDFs (es un contrato/factura de alquiler) y máximo 10MB — sin esto,
// multer aceptaba cualquier archivo de cualquier tamaño de quien tuviera
// sesión de admin, y /uploads se sirve como estático (un .html o .svg
// subido se serviría con su propio Content-Type).
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Solo se permiten archivos PDF'));
    }
    cb(null, true);
  }
});

const router = express.Router();

let currentMemoryData = { ...logisticsData };
let currentMemoryWeeks = {
  week_3: {
    weekId: "week_3",
    id: "week_3",
    name: "Semana 3",
    ...logisticsData
  }
};

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const data = await Logistics.findOne().sort({ updatedAt: -1 });
      if (data) return res.json(data);
    }
    res.json(currentMemoryData);
  } catch (error) {
    console.error('Error al obtener logística:', error);
    res.json(currentMemoryData);
  }
});

// POST /api/logistics/update - Legacy, sin caller en el cliente actual
// (superado por /api/logistics/weeks) pero se mantiene por compatibilidad;
// protegido igual que el resto de escrituras para no dejarlo abierto.
router.post('/update', requireAdmin, async (req, res) => {
  try {
    const updatedData = req.body;
    currentMemoryData = { ...currentMemoryData, ...updatedData };

    if (mongoose.connection.readyState === 1) {
      await Logistics.create(updatedData);
    }

    res.json({ success: true, data: currentMemoryData });
  } catch (error) {
    console.error('Error al actualizar logística:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/logistics/weeks - Get all saved weekly schedules
router.get('/weeks', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let weeksDocs = await LogisticsWeek.find();

      // First-ever read: bootstrap Mongo from the seed so every device
      // starts from the same shared week instead of each browser's own copy.
      if (!weeksDocs || weeksDocs.length === 0) {
        const seeded = await LogisticsWeek.create({
          weekId: 'week_3',
          name: 'Semana 3',
          ...logisticsData
        });
        weeksDocs = [seeded];
      }

      const weeksMap = {};
      weeksDocs.forEach(w => {
        weeksMap[w.weekId] = w;
      });
      return res.json(weeksMap);
    }
    return res.json(currentMemoryWeeks);
  } catch (error) {
    console.error('Error al obtener semanas:', error);
    return res.json(currentMemoryWeeks);
  }
});

// POST /api/logistics/weeks - Save or update entire weeks map (reemplaza el
// documento completo de cada semana). Solo Admin: esto puede tocar
// camiones, horarios y asignaciones de cualquier semana, así que no puede
// quedar abierto a cualquiera con la URL del servidor. El auto-completado
// de tareas al fichar (que sí necesitan hacer trabajadores sin sesión) usa
// en su lugar el endpoint estrecho PATCH /weeks/:weekId/tasks de abajo.
router.post('/weeks', requireAdmin, async (req, res) => {
  try {
    const weeksPayload = req.body; // { week_3: {...}, week_4: {...} }

    if (mongoose.connection.readyState === 1) {
      // Control de concurrencia: cada semana del payload puede traer el
      // `updatedAt` que el cliente tenía cuando la abrió para editar (ya
      // viene solo, es el mismo campo que devuelve GET /weeks sin que el
      // cliente lo toque). Si ya no coincide con el actual en Mongo,
      // alguien más la guardó por medio — antes este POST reemplazaba el
      // documento entero a ciegas sin comprobarlo (demostrado en vivo con
      // una reasignación perdida). No se aborta todo el payload por un
      // conflicto en una semana: las demás se guardan igual.
      const conflicts = [];
      // Se acumula la versión REAL y fresca de Mongo de cada semana tocada
      // en esta petición (recién guardada, o la que ya había si hubo
      // conflicto) — `currentMemoryWeeks` es solo una caché en memoria que
      // ninguna otra ruta mantiene al día (GET /weeks lee Mongo directo sin
      // tocarla), así que devolverla tal cual en una respuesta de conflicto
      // podría enseñar una versión más vieja todavía que la que causó el
      // conflicto en primer lugar.
      const freshDocs = {};
      for (const [weekId, weekData] of Object.entries(weeksPayload)) {
        const existing = await LogisticsWeek.findOne({ weekId });
        if (existing && weekData.updatedAt &&
            new Date(existing.updatedAt).getTime() !== new Date(weekData.updatedAt).getTime()) {
          conflicts.push(weekId);
          freshDocs[weekId] = existing;
          continue;
        }
        const saved = await LogisticsWeek.findOneAndUpdate(
          { weekId },
          { ...weekData, weekId },
          { upsert: true, new: true }
        );
        freshDocs[weekId] = saved;
      }

      currentMemoryWeeks = { ...currentMemoryWeeks, ...freshDocs };

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          conflict: true,
          conflicts,
          message: 'Alguien más ha guardado cambios en esta semana mientras la editabas. Recarga la página para ver la versión más reciente antes de repetir tu cambio, para no perder el otro.',
          data: currentMemoryWeeks
        });
      }
    } else {
      currentMemoryWeeks = { ...currentMemoryWeeks, ...weeksPayload };
    }

    return res.json({ success: true, data: currentMemoryWeeks });
  } catch (error) {
    console.error('Error al actualizar semanas:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/logistics/weeks/draft - Crea una semana en BORRADOR (la que genera
// el planificador automático desde el calendario). A diferencia de POST /weeks
// (que reemplaza el documento entero a ciegas), esta ruta NUNCA pisa nada:
//   · solo acepta semanas con meta.status === 'Borrador';
//   · si el weekId ya existe responde 409, salvo `reemplazar: true` y solo si
//     lo que hay ya es otro BORRADOR (una semana aceptada nunca se toca aquí);
//   · el índice único de weekId hace que dos sesiones a la vez no dupliquen.
router.post('/weeks/draft', requireAdmin, async (req, res) => {
  try {
    const { weekId, week, reemplazar } = req.body || {};
    if (typeof weekId !== 'string' || !/^week_[A-Za-z0-9_-]{1,60}$/.test(weekId)) {
      return res.status(400).json({ error: 'weekId debe tener la forma week_<algo>' });
    }
    if (!week || typeof week !== 'object' || typeof week.name !== 'string' || week.meta?.status !== 'Borrador') {
      return res.status(400).json({ error: 'week debe ser una semana con name y meta.status "Borrador"' });
    }
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Se requiere conexión activa a MongoDB Atlas' });
    }

    const existing = await LogisticsWeek.findOne({ weekId });
    if (!existing) {
      try {
        const created = await LogisticsWeek.create({ ...week, weekId, id: weekId });
        return res.status(201).json({ success: true, creada: true, data: created });
      } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ success: false, existe: true, error: 'Esa semana ya existe' });
        throw err;
      }
    }

    if (reemplazar === true && existing.meta?.status === 'Borrador') {
      const updated = await LogisticsWeek.findOneAndUpdate(
        { weekId },
        { ...week, weekId, id: weekId },
        { new: true }
      );
      return res.json({ success: true, reemplazada: true, data: updated });
    }

    return res.status(409).json({
      success: false,
      existe: true,
      borrador: existing.meta?.status === 'Borrador',
      error: existing.meta?.status === 'Borrador'
        ? 'Esa semana ya existe como borrador (usa reemplazar para regenerarla)'
        : 'Esa semana ya existe y no es un borrador: no se toca'
    });
  } catch (error) {
    console.error('Error al crear el borrador de semana:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/logistics/weeks/:weekId - Eliminar una semana
router.delete('/weeks/:weekId', requireAdmin, async (req, res) => {
  try {
    const { weekId } = req.params;
    if (mongoose.connection.readyState === 1) {
      const result = await LogisticsWeek.deleteOne({ weekId });
      if (result.deletedCount === 0) {
        return res.status(404).json({ success: false, message: 'Semana no encontrada' });
      }
      delete currentMemoryWeeks[weekId];
    } else {
      if (!currentMemoryWeeks[weekId]) {
        return res.status(404).json({ success: false, message: 'Semana no encontrada' });
      }
      delete currentMemoryWeeks[weekId];
    }
    return res.json({ success: true, message: 'Semana eliminada' });
  } catch (error) {
    console.error('Error al eliminar semana:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/logistics/weeks/:weekId/tasks - Marca/desmarca UNA tarea como
// completada. Sin requireAdmin a propósito: es lo único que necesita el
// flujo de un trabajador (autocompletar su tarea al fichar salida, o
// tocar su propia tarea en su cuadrante) sin tener sesión de admin — a
// cambio, este endpoint SOLO puede escribir el campo `completed` de una
// tarea concreta de un día concreto (vía $set con ruta acotada), nunca
// camiones, horarios, asignaciones, ni ningún otro dato de la semana.
router.patch('/weeks/:weekId/tasks', async (req, res) => {
  try {
    const { weekId } = req.params;
    const { dayKey, taskIndex, completed, reopened, completedAt } = req.body;

    if (typeof dayKey !== 'string' || !dayKey || !Number.isInteger(taskIndex) || taskIndex < 0 || typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'dayKey (string), taskIndex (entero >= 0) y completed (booleano) son obligatorios' });
    }
    if (reopened !== undefined && typeof reopened !== 'boolean') {
      return res.status(400).json({ error: 'reopened, si se envía, debe ser un booleano' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Se requiere conexión activa a MongoDB Atlas para guardar el estado de la tarea' });
    }

    const week = await LogisticsWeek.findOne({ weekId });
    if (!week) return res.status(404).json({ error: 'Semana no encontrada' });

    // Mismo caso especial que taskPlanning.js en el cliente: domingo y
    // lunes comparten sundayMonday.tasks (no schedule.domingo, que ni
    // existe), y sábado vive en saturdaySpecial.weddings, no en
    // schedule.sabado. Sin este tercer caso, marcar una boda de sábado como
    // completada devolvía 404 (list quedaba vacío) aunque el cliente ya la
    // mostrara marcada en local — se revertía sola en el siguiente refresco.
    const isDomingoOLunes = dayKey === 'domingo' || dayKey === 'lunes';
    const isSabado = dayKey === 'sabado';
    const list = (isSabado ? week.saturdaySpecial?.weddings : isDomingoOLunes ? week.sundayMonday?.tasks : week.schedule?.[dayKey]?.tasks) || [];
    const current = list[taskIndex];
    if (current === undefined) return res.status(404).json({ error: 'Tarea no encontrada en ese día' });

    // Sin cambio real -> no se escribe. Cada escritura sube `updatedAt`, y
    // el POST /weeks de un admin compara contra ese valor: una sesión con el
    // estado desactualizado que repite el mismo PATCH cada 20s (el sondeo de
    // autoCompletePastTasks) hacía que TODOS los guardados de admin
    // chocaran con "Alguien más ha guardado cambios" sin que nadie hubiera
    // cambiado nada. PATCH es idempotente: repetirlo no debe tocar el doc.
    // `reopened` (opcional) = alguien DESMARCÓ la tarea a propósito: el reloj del
    // cliente ya no debe volver a darla por hecha. Solo se puede tocar junto
    // a `completed`; el endpoint sigue sin poder escribir nada más.
    const currentCompleted = !!(current && typeof current === 'object' && current.completed);
    const currentReopened = !!(current && typeof current === 'object' && current.reopened);
    if (currentCompleted === completed && (reopened === undefined || currentReopened === reopened) && (!completedAt)) {
      return res.json({ success: true, unchanged: true, data: week });
    }

    const changes = { completed, reopened: reopened !== undefined ? reopened : currentReopened };
    if (completedAt !== undefined) {
      changes.completedAt = completedAt;
    }
    
    const updatedTask = (current && typeof current === 'object') ? { ...current, ...changes } : { text: current, ...changes };
    const fieldPath = isSabado
      ? `saturdaySpecial.weddings.${taskIndex}`
      : isDomingoOLunes ? `sundayMonday.tasks.${taskIndex}` : `schedule.${dayKey}.tasks.${taskIndex}`;

    const updated = await LogisticsWeek.findOneAndUpdate(
      { weekId },
      { $set: { [fieldPath]: updatedTask } },
      { new: true }
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error al actualizar tarea de la semana:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/logistics/upload-rental
router.post('/upload-rental', requireAdmin, (req, res, next) => {
  // No hay un error-handler global en server.js, así que si fileFilter o
  // el límite de tamaño rechazan el archivo, multer llama a next(err) y sin
  // esto Express devolvería su página HTML de error 500 en vez de JSON.
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ success: true, url: fileUrl });
});

// POST /api/logistics/optimize
router.post('/optimize', requireAdmin, async (req, res) => {
  try {
    let deletedCount = 0;
    
    // Solo optimizamos si estamos conectados a MongoDB
    if (mongoose.connection.readyState === 1) {
      // Importar modelo de fichajes
      const { ClockEntry } = await import('../models/ClockEntry.model.js');
      // Borrar fichajes marcados como borrados (papelera) — el campo real
      // en el schema es `deleted`, no `isDeleted` (ver clock.routes.js).
      const result = await ClockEntry.deleteMany({ deleted: true });
      deletedCount = result.deletedCount;
      
      // Opcional: borrar semanas viejas si hay más de 10
      const weeksCount = await LogisticsWeek.countDocuments();
      if (weeksCount > 10) {
        // ... en el futuro
      }
    }
    
    res.json({ 
      success: true, 
      message: `Base de datos optimizada. Se han purgado ${deletedCount} registros antiguos o eliminados permanentemente.` 
    });
  } catch (error) {
    console.error('Error optimizando DB:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
