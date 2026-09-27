import express from 'express';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { AiMemory } from '../models/AiMemory.js';

const router = express.Router();

// Mismo tope que el cliente (MAX_MEMORIA_IA en geminiScheduleService.js).
const MAX_MEMORIA_IA = 300;

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
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    // Cada recuerdo entra en TODOS los prompts futuros de Gemini: frases cortas.
    if (!content || content.length > MAX_MEMORIA_IA) {
      return res.status(400).json({ error: `El recuerdo debe ser un texto de 1 a ${MAX_MEMORIA_IA} caracteres` });
    }
    // Pedir lo mismo dos veces (p. ej. reintentar una generación) no lo duplica.
    const existente = await AiMemory.findOne({ content });
    if (existente) return res.status(200).json(existente);
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
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ error: 'Id de recuerdo no válido' });
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
