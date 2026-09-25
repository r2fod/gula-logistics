import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { AiMemory } from '../models/AiMemory.js';

const router = express.Router();

// GET /api/aimemory - Obtener todos los recuerdos
router.get('/', requireAdmin, async (req, res) => {
  try {
    const memories = await AiMemory.find().sort({ createdAt: -1 });
    res.json(memories);
  } catch (error) {
    console.error('Error al obtener memorias:', error);
    res.status(500).json({ error: 'Error al leer la base de datos' });
  }
});

// POST /api/aimemory - Añadir un recuerdo
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'El contenido es requerido y debe ser texto' });
    }
    const newMemory = new AiMemory({ content });
    await newMemory.save();
    res.status(201).json(newMemory);
  } catch (error) {
    console.error('Error al crear memoria:', error);
    res.status(500).json({ error: 'Error al guardar en la base de datos' });
  }
});

// DELETE /api/aimemory/:id - Eliminar un recuerdo
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedMemory = await AiMemory.findByIdAndDelete(id);
    if (!deletedMemory) {
      return res.status(404).json({ error: 'Memoria no encontrada' });
    }
    res.json({ message: 'Memoria eliminada correctamente', deletedMemory });
  } catch (error) {
    console.error('Error al eliminar memoria:', error);
    res.status(500).json({ error: 'Error al borrar de la base de datos' });
  }
});

export default router;
