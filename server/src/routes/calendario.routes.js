import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { leerApuntes, calendarioConfigurado, CalendarioError } from '../services/calendario.js';

const router = express.Router();

// GET /api/calendario/estado — ¿está configurado? (sin datos)
router.get('/estado', requireAdmin, (req, res) => {
  res.json({ configurado: calendarioConfigurado() });
});

// GET /api/calendario/eventos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Solo admin: el calendario tiene nombres de clientes, lugares y pax.
router.get('/eventos', requireAdmin, async (req, res) => {
  try {
    const apuntes = await leerApuntes({ desde: req.query.desde, hasta: req.query.hasta });
    res.json({ configurado: true, apuntes });
  } catch (err) {
    if (err instanceof CalendarioError) {
      return res.status(err.estado).json({ configurado: err.estado !== 503, error: err.message });
    }
    console.error('Error leyendo el calendario:', err.message);
    res.status(500).json({ error: 'Error interno leyendo el calendario' });
  }
});

export default router;
