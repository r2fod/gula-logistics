import express from 'express';
import mongoose from 'mongoose';
import { ClockEntry } from '../models/ClockEntry.model.js';

const router = express.Router();

// Fallback in-memory storage when Mongo is offline
let memoryClockEntries = [];

// GET /api/clock - Get all clock entries (optional query ?worker=Name)
router.get('/', async (req, res) => {
  try {
    const { worker } = req.query;

    if (mongoose.connection.readyState === 1) {
      const query = worker ? { workerName: new RegExp(`^${worker}$`, 'i') } : {};
      const entries = await ClockEntry.find(query).sort({ createdAt: -1 });
      return res.json(entries);
    }

    let filtered = memoryClockEntries;
    if (worker) {
      filtered = memoryClockEntries.filter(e => e.workerName?.toLowerCase() === worker.toLowerCase());
    }
    return res.json(filtered);
  } catch (error) {
    console.error('Error al obtener fichajes:', error);
    return res.status(500).json({ error: 'Error al consultar fichajes en el servidor' });
  }
});

// POST /api/clock - Add new clock entry
router.post('/', async (req, res) => {
  try {
    const newEntryData = req.body;
    if (!newEntryData.id) {
      newEntryData.id = Date.now().toString();
    }

    if (mongoose.connection.readyState === 1) {
      const entryDoc = await ClockEntry.create(newEntryData);
      return res.status(201).json(entryDoc);
    }

    memoryClockEntries.push(newEntryData);
    return res.status(201).json(newEntryData);
  } catch (error) {
    console.error('Error al registrar fichaje:', error);
    return res.status(500).json({ error: error.message || 'Error al guardar fichaje en base de datos' });
  }
});

// PUT /api/clock/:id - Update existing clock entry
router.put('/:id', async (req, res) => {
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
      memoryClockEntries[idx] = { ...memoryClockEntries[idx], ...updateData };
      return res.json(memoryClockEntries[idx]);
    }
    return res.status(404).json({ error: 'Fichaje no encontrado en memoria' });
  } catch (error) {
    console.error('Error al actualizar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clock/:id - Delete single entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      await ClockEntry.deleteOne({ id });
      return res.json({ success: true, message: 'Fichaje eliminado de Mongo Atlas' });
    }

    memoryClockEntries = memoryClockEntries.filter(e => e.id !== id);
    return res.json({ success: true, message: 'Fichaje eliminado de memoria local' });
  } catch (error) {
    console.error('Error al borrar fichaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clock - Clear all entries (Admin reset)
router.delete('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await ClockEntry.deleteMany({});
    }
    memoryClockEntries = [];
    return res.json({ success: true, message: 'Todos los fichajes eliminados correctamente' });
  } catch (error) {
    console.error('Error al vaciar fichajes:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
