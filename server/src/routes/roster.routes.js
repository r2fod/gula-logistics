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
const DIAS = ['semana', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'lunes'];
const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;
// Solo lo que la app sabe usar: lo demás de la disponibilidad fija se descarta y la
// nota se acota (entra en los prompts de Gemini).
const limpiarTrabajador = (w) => ({
  ...w,
  backup: w.backup === true,
  nota: String(w.nota || '').trim().slice(0, 120),
  disponibilidad: (Array.isArray(w.disponibilidad) ? w.disponibilidad : [])
    .filter(r => r && DIAS.includes(r.dia) && ['no', 'descansa', 'solo'].includes(r.tipo) && (r.tipo !== 'solo' || (HORA.test(r.desde || '') && HORA.test(r.hasta || ''))))
    .slice(0, 14)
    .map(r => ({ dia: r.dia, tipo: r.tipo, desde: r.tipo === 'solo' ? r.desde : '', hasta: r.tipo === 'solo' ? r.hasta : '' })),
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    if (!Array.isArray(req.body?.workers)) {
      return res.status(400).json({ error: 'Se esperaba un array de trabajadores' });
    }
    const workers = req.body.workers.map(limpiarTrabajador);

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
