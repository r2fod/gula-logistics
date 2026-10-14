import express from 'express';
import mongoose from 'mongoose';
import { TeamRoster } from '../models/TeamRoster.model.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { tarifasDelDocumento, tarifasValidas } from '../utils/tarifas.js';

const router = express.Router();

// El equipo y sus tarifas por defecto viven en Mongo (se editan desde la app). Sin
// conexión, en memoria. No hay lista ni tarifas por defecto en el código: el repo es
// público y llevaba nombres y tarifas reales.
let memoryRoster = [];
let memoryTarifas = {};

// GET /api/roster - Obtener lista de trabajadores activos y las tarifas por defecto
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rosterDoc = await TeamRoster.findOne({ key: 'roster' });
      // Base nueva sin equipo: lista vacía (el admin lo añade). Un GET público no escribe.
      return res.json({ workers: rosterDoc?.workers || [], tarifas: tarifasDelDocumento(rosterDoc) });
    }
    // Fallback if DB is disconnected
    return res.json({ workers: memoryRoster, tarifas: memoryTarifas });
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

// Cambia el equipo, las tarifas por defecto o las dos: solo lo que llega (guardar el
// equipo no toca las tarifas y al revés).
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { workers: enviados, tarifas: tarifasEnviadas } = req.body || {};
    if (enviados === undefined && tarifasEnviadas === undefined) {
      return res.status(400).json({ error: 'Se esperaba un array de trabajadores o las tarifas por defecto' });
    }
    if (enviados !== undefined && !Array.isArray(enviados)) {
      return res.status(400).json({ error: 'Se esperaba un array de trabajadores' });
    }
    const tarifas = tarifasEnviadas === undefined ? undefined : tarifasValidas(tarifasEnviadas);
    if (tarifas === null) {
      return res.status(400).json({ error: 'Las tarifas deben ser números mayores que 0 y de 100 como mucho (extra, nomina, transporte)' });
    }
    const cambios = {};
    if (enviados !== undefined) cambios.workers = enviados.map(limpiarTrabajador);
    if (tarifas !== undefined) cambios.tarifas = tarifas;

    if (mongoose.connection.readyState === 1) {
      const rosterDoc = await TeamRoster.findOneAndUpdate(
        { key: 'roster' },
        cambios,
        { new: true, upsert: true }
      );
      return res.json({ success: true, workers: rosterDoc.workers, tarifas: tarifasDelDocumento(rosterDoc) });
    } else {
      if (cambios.workers) memoryRoster = [...cambios.workers];
      if (cambios.tarifas) memoryTarifas = { ...cambios.tarifas };
      return res.json({ success: true, workers: memoryRoster, tarifas: memoryTarifas });
    }
  } catch (error) {
    console.error('Error al actualizar roster:', error);
    res.status(500).json({ error: 'Failed to update team roster' });
  }
});

export default router;
