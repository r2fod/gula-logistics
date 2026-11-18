import express from 'express';
import mongoose from 'mongoose';
import { WorkerBalance } from '../models/WorkerBalance.model.js';
import { initialBalancesData } from '../data/balancesData.js';
import { requireAdmin, requireLectura, requireTrabajador } from '../middleware/requireAdmin.js';
import { validarApuntes, saldoDeApuntes, apuntesQuitados, hayClavesPeligrosas, soloCamposDeFicha } from '../services/apuntesSaldos.js';

const router = express.Router();

let memoryBalancesData = { ...initialBalancesData };

// GET /api/balances - Saldos y acuerdos de cada persona (dinero): solo admin o
// enlace de socias. Antes era público: cualquiera con la URL de la API los leía.
router.get('/', requireLectura, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const dbWorkers = await WorkerBalance.find({}, '-apuntesBorrados').sort({ createdAt: 1 });
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

// GET /api/balances/mio — la ficha de Saldos del trabajador del enlace firmado
// (y SOLO la suya: el id va dentro del token, no se puede pedir otra). Lo justo
// para calcular su saldo en su vista; sin teléfono ni notas internas.
const CAMPOS_PROPIOS = 'id name currentBalance breakdown hourlyRate statusType isSpecialPurse purseInfo hasTransportBonus updatedAt';
router.get('/mio', requireTrabajador, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'Base de datos no disponible' });
    const ficha = await WorkerBalance.findOne({ id: req.admin.w }).select(CAMPOS_PROPIOS).lean();
    if (!ficha) return res.status(404).json({ error: 'No hay ficha de saldo para este enlace' });
    return res.json(ficha);
  } catch (error) {
    console.error('Error al leer el saldo propio:', error);
    return res.status(500).json({ error: 'No se pudo leer el saldo' });
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
    if (hayClavesPeligrosas(req.body)) return res.status(400).json({ error: 'El cuerpo trae claves no permitidas (con punto o $)' });
    // Solo campos de la ficha: `id`, el rastro y las marcas de Mongo no se escriben desde fuera.
    const updatePayload = soloCamposDeFicha(req.body);

    // Dinero: los apuntes se validan y el saldo lo calcula el servidor con ellos. Un
    // `currentBalance` que llegue (con o sin desglose) se descarta.
    let apuntes = null;
    if (updatePayload.breakdown !== undefined) {
      const validado = validarApuntes(updatePayload.breakdown);
      if (validado.error) return res.status(400).json({ error: validado.error });
      apuntes = validado.apuntes;
      updatePayload.breakdown = apuntes;
      updatePayload.currentBalance = saldoDeApuntes(apuntes);
    }

    if (mongoose.connection.readyState === 1) {
      const actualizacion = { $set: updatePayload, $setOnInsert: { id } };
      let filtro = { id };
      let existe = false;
      if (apuntes) {
        const anterior = await WorkerBalance.findOne({ id });
        existe = !!anterior;
        // Solo se guarda si la ficha sigue como se leyó: si otro admin guardó entre medias,
        // este guardado le pisaría su cambio (409, como las semanas).
        if (anterior?.updatedAt) filtro = { id, updatedAt: anterior.updatedAt };
        // Rastro de lo que se quita (un pago borrado ya no desaparece sin más).
        const quitados = apuntesQuitados(anterior?.breakdown, apuntes);
        if (quitados.length) {
          const borradoEn = new Date().toISOString();
          actualizacion.$push = { apuntesBorrados: {
            $each: quitados.map(({ concept, amount, date, tipo }) => ({ concept, amount, date, tipo, borradoEn })),
            $slice: -200,
          } };
        }
      }
      const updatedDoc = await WorkerBalance.findOneAndUpdate(filtro, actualizacion, { new: true, upsert: !existe });
      if (!updatedDoc) return res.status(409).json({ error: 'Esta ficha ha cambiado mientras se guardaba. Recarga y repite el cambio.' });
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
