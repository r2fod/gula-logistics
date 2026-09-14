import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
import { Logistics } from '../models/Logistics.model.js';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const data = await Logistics.findOne().sort({ updatedAt: -1 });
      if (data) return res.json(data);
    }
    // Fallback a los datos iniciales si no hay registro o si se ejecuta en modo standalone
    res.json(logisticsData);
  } catch (error) {
    console.error('Error al obtener logística:', error);
    res.json(logisticsData);
  }
});

export default router;
