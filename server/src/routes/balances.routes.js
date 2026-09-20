import express from 'express';
import mongoose from 'mongoose';
import { WorkerBalance } from '../models/WorkerBalance.model.js';
import { initialBalancesData } from '../data/balancesData.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

let memoryBalancesData = { ...initialBalancesData };

// GET /api/balances - Get all worker balances & financial data (Admin/Socias)
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbWorkers = await WorkerBalance.find().sort({ createdAt: 1 });
      if (dbWorkers && dbWorkers.length > 0) {
        return res.json({
          lastUpdated: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
          workers: dbWorkers
        });
      }
    }
    return res.json(memoryBalancesData);
  } catch (error) {
    console.error('Error al obtener saldos:', error);
    return res.json(memoryBalancesData);
  }
});

// POST /api/balances/seed - Seed financial balances to MongoDB Atlas (Admin only)
// Accepts an optional { workers: [...] } body to migrate real data one time
// without ever committing it to the repo; defaults to the neutral placeholder.
router.post('/seed', requireAdmin, async (req, res) => {
  try {
    const workersToSeed = Array.isArray(req.body?.workers) && req.body.workers.length > 0
      ? req.body.workers
      : initialBalancesData.workers;

    if (mongoose.connection.readyState === 1) {
      await WorkerBalance.deleteMany({});
      const created = await WorkerBalance.insertMany(workersToSeed);
      return res.json({ success: true, message: `${created.length} registros financieros migrados a MongoDB Atlas` });
    }
    memoryBalancesData = { ...memoryBalancesData, workers: workersToSeed };
    return res.json({ success: true, message: 'Seeding completado en memoria local' });
  } catch (error) {
    console.error('Error seeding balances:', error);
    return res.status(500).json({ error: error.message });
  }
});

// PUT /api/balances/:id - Update specific worker balance or add breakdown item (Admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // El cliente siempre manda un payload PARCIAL (ej. solo {breakdown,
    // currentBalance} al añadir un turno) — nunca el documento completo.
    // Un objeto sin operadores ($set, etc.) que se pasa tal cual a
    // findOneAndUpdate lo trata MongoDB como documento de REEMPLAZO
    // completo, no como una actualización parcial: cualquier campo no
    // incluido en el payload (name, avatar, hasTransportBonus, purseInfo,
    // agreements...) se borraría del documento entero. `id` fuera del
    // propio payload para que $set/$setOnInsert nunca compitan por el
    // mismo campo.
    const { id: _ignored, ...updatePayload } = req.body || {};

    if (mongoose.connection.readyState === 1) {
      const updatedDoc = await WorkerBalance.findOneAndUpdate(
        { id },
        { $set: updatePayload, $setOnInsert: { id } },
        { new: true, upsert: true }
      );
      return res.json(updatedDoc);
    }

    const idx = memoryBalancesData.workers.findIndex(w => w.id === id);
    if (idx !== -1) {
      memoryBalancesData.workers[idx] = { ...memoryBalancesData.workers[idx], ...updatePayload };
      return res.json(memoryBalancesData.workers[idx]);
    } else {
      memoryBalancesData.workers.push({ id, ...updatePayload });
      return res.json({ id, ...updatePayload });
    }
  } catch (error) {
    console.error('Error al actualizar saldo:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
