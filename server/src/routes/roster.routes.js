import express from 'express';
import mongoose from 'mongoose';
import { TeamRoster } from '../models/TeamRoster.model.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

// Fallback in-memory roster if database is not available
const DEFAULT_WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión Covey (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión Gula (Propio)", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión Covey / Apoyo", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Irene", role: "Ayudante Logística / Prepara Eventos / Verifica Checklist", truck: "Almacén Base", avatar: "📦", isPayroll: true, rate: 14 },
  { name: "Jeferson", role: "Apoyo Logística & Prep", truck: "Base / Camión Gula", avatar: "📦", isPayroll: false, rate: 10 },
  { name: "Kerly", role: "Gula Limpieza Eventos", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Jose", role: "Gula Limpieza & Apoyo", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Raúl", role: "Jefe de Logística", truck: "Supervisión Flota", avatar: "📋", isPayroll: true, rate: 14 }
];

let memoryRoster = [...DEFAULT_WORKERS_LIST];

// GET /api/roster - Obtener lista de trabajadores activos
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rosterDoc = await TeamRoster.findOne({ key: 'roster' });
      if (rosterDoc && rosterDoc.workers) {
        return res.json({ workers: rosterDoc.workers });
      } else {
        // If no document exists in DB yet, seed it with the default list
        const newDoc = await TeamRoster.create({ key: 'roster', workers: DEFAULT_WORKERS_LIST });
        return res.json({ workers: newDoc.workers });
      }
    }
    // Fallback if DB is disconnected
    return res.json({ workers: memoryRoster });
  } catch (error) {
    console.error('Error al obtener roster:', error);
    res.status(500).json({ error: 'Failed to fetch team roster' });
  }
});

// PUT /api/roster - Actualizar lista completa de trabajadores (Admin only)
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { workers } = req.body;
    if (!Array.isArray(workers)) {
      return res.status(400).json({ error: 'Se esperaba un array de trabajadores' });
    }

    if (mongoose.connection.readyState === 1) {
      const rosterDoc = await TeamRoster.findOneAndUpdate(
        { key: 'roster' },
        { workers },
        { new: true, upsert: true }
      );
      return res.json({ success: true, workers: rosterDoc.workers });
    } else {
      memoryRoster = [...workers];
      return res.json({ success: true, workers: memoryRoster });
    }
  } catch (error) {
    console.error('Error al actualizar roster:', error);
    res.status(500).json({ error: 'Failed to update team roster' });
  }
});

export default router;
