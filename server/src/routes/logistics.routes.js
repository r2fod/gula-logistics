import express from 'express';
import { logisticsData } from '../data/logisticsData.js';
const router = express.Router();
router.get('/', (req, res) => res.json(logisticsData));
export default router;
