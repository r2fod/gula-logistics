import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
import { Logistics } from '../models/Logistics.model.js';
import mongoose from 'mongoose';

const router = express.Router();

let currentMemoryData = { ...logisticsData };

router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const data = await Logistics.findOne().sort({ updatedAt: -1 });
      if (data) return res.json(data);
    }
    res.json(currentMemoryData);
  } catch (error) {
    console.error('Error al obtener logística:', error);
    res.json(currentMemoryData);
  }
});

router.post('/update', async (req, res) => {
  try {
    const updatedData = req.body;
    currentMemoryData = { ...currentMemoryData, ...updatedData };

    if (mongoose.connection.readyState === 1) {
      await Logistics.create(updatedData);
    }

    res.json({ success: true, data: currentMemoryData });
  } catch (error) {
    console.error('Error al actualizar logística:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
