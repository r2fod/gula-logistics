import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
import { Logistics } from '../models/Logistics.model.js';
import { LogisticsWeek } from '../models/LogisticsWeek.model.js';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/requireAdmin.js';

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
    currentMemoryWeeks = { ...currentMemoryWeeks, ...weeksPayload };

    if (mongoose.connection.readyState === 1) {
      for (const [weekId, weekData] of Object.entries(weeksPayload)) {
        await LogisticsWeek.findOneAndUpdate(
          { weekId },
          { ...weekData, weekId },
          { upsert: true, new: true }
        );
      }
    }

    return res.json({ success: true, data: currentMemoryWeeks });
  } catch (error) {
    console.error('Error al actualizar semanas:', error);
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
    const { dayKey, taskIndex, completed } = req.body;

    if (typeof dayKey !== 'string' || !dayKey || !Number.isInteger(taskIndex) || taskIndex < 0 || typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'dayKey (string), taskIndex (entero >= 0) y completed (booleano) son obligatorios' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Se requiere conexión activa a MongoDB Atlas para guardar el estado de la tarea' });
    }

    const week = await LogisticsWeek.findOne({ weekId });
    if (!week) return res.status(404).json({ error: 'Semana no encontrada' });

    // Mismo caso especial que taskPlanning.js en el cliente: domingo y
    // lunes comparten sundayMonday.tasks, no schedule.domingo (que ni existe).
    const isDomingo = dayKey === 'domingo';
    const list = (isDomingo ? week.sundayMonday?.tasks : week.schedule?.[dayKey]?.tasks) || [];
    const current = list[taskIndex];
    if (current === undefined) return res.status(404).json({ error: 'Tarea no encontrada en ese día' });

    const updatedTask = (current && typeof current === 'object') ? { ...current, completed } : { text: current, completed };
    const fieldPath = isDomingo ? `sundayMonday.tasks.${taskIndex}` : `schedule.${dayKey}.tasks.${taskIndex}`;

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

export default router;
