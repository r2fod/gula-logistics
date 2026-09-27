import express from 'express';
import mongoose from 'mongoose';
import { TeamRoster } from '../models/TeamRoster.model.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

// El equipo vive en Mongo (se edita desde la app). Sin conexión, en memoria. No hay
// lista por defecto en el código: el repo es público y llevaba nombres y tarifas reales.
let memoryRoster = [];

// GET /api/roster - Obtener lista de trabajadores activos
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rosterDoc = await TeamRoster.findOne({ key: 'roster' });
      // Base nueva sin equipo: lista vacía (el admin lo añade). Un GET público no escribe.
      return res.json({ workers: rosterDoc?.workers || [] });
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
