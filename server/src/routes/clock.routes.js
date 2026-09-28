import express from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { ClockEntry } from '../models/ClockEntry.model.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

// Fallback in-memory storage when Mongo is offline
let memoryClockEntries = [];
// Lo que se guarda en memoria lleva su propia marca de cambio, como Mongo con
// `timestamps`, para que ?desde= también funcione sin base de datos.
const conMarca = (e) => ({ ...e, updatedAt: new Date().toISOString() });

// El nombre llega del navegador: se escapa antes de meterlo en una expresión
// regular (antes iba tal cual: con un patrón malicioso se podía cargar la base).
const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/clock - Fichajes (opcional ?worker=Nombre). Con ?desde=<fecha ISO>, solo
// los creados o cambiados desde entonces (también los borrados: se marcan, no se
// quitan): la app sondea cada 20 s y así no descarga el histórico entero cada vez.
router.get('/', async (req, res) => {
  try {
    const { worker, desde } = req.query;
    const desdeFecha = desde ? new Date(String(desde)) : null;
    if (desdeFecha && Number.isNaN(desdeFecha.getTime())) {
      return res.status(400).json({ error: 'desde debe ser una fecha ISO' });
    }

    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (worker) query.workerName = new RegExp(`^${escaparRegex(worker)}$`, 'i');
      if (desdeFecha) query.updatedAt = { $gte: desdeFecha };
      const entries = await ClockEntry.find(query).sort({ createdAt: -1 });
      return res.json(entries);
    }

    let filtered = memoryClockEntries;
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
router.post('/', async (req, res) => {
  try {
    const newEntryData = { ...req.body };
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let isAdmin = false;
    
    if (token) {
      try {
        const { verifyToken } = await import('../utils/authToken.js');
        const payload = verifyToken(token);
        if (payload && payload.role === 'admin') isAdmin = true;
      } catch (e) {
        console.error('Invalid token on delete', e);
      }
    }

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
