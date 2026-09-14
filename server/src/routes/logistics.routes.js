import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
import { Logistics } from '../models/Logistics.model.js';
import { LogisticsWeek } from '../models/LogisticsWeek.model.js';
import mongoose from 'mongoose';

const router = express.Router();

let currentMemoryData = { ...logisticsData };
let currentMemoryWeeks = {
  week_3: {
    id: "week_3",
    name: "Semana 3",
    ...logisticsData
  }
};

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

// GET /api/logistics/weeks - Get all saved weekly schedules
router.get('/weeks', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const weeksDocs = await LogisticsWeek.find();
      if (weeksDocs && weeksDocs.length > 0) {
        const weeksMap = {};
        weeksDocs.forEach(w => {
          weeksMap[w.weekId] = w;
        });
        return res.json(weeksMap);
      }
    }
    return res.json(currentMemoryWeeks);
  } catch (error) {
    console.error('Error al obtener semanas:', error);
    return res.json(currentMemoryWeeks);
  }
});

// POST /api/logistics/weeks - Save or update entire weeks map
router.post('/weeks', async (req, res) => {
  try {
    const weeksPayload = req.body; // { week_3: {...}, week_4: {...} }
    currentMemoryWeeks = { ...currentMemoryWeeks, ...weeksPayload };

    if (mongoose.connection.readyState === 1) {
      for (const [weekId, weekData] of Object.entries(weeksPayload)) {
        await LogisticsWeek.findOneAndUpdate(
          { weekId },
          { ...weekData, weekId },
          { upsert: true, new: true }
        );
      }
    }

    return res.json({ success: true, data: currentMemoryWeeks });
  } catch (error) {
    console.error('Error al actualizar semanas:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
