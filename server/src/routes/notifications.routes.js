import express from 'express';
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const router = express.Router();

try {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:info@gulalogistics.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } else {
    console.warn('⚠️ VAPID keys missing. Push notifications will be disabled.');
  }
} catch (e) {
  console.warn('⚠️ Error setting VAPID details:', e.message);
}

// Helper middleware (can be moved later)
const requireAdmin = (req, res, next) => {
  const adminToken = req.headers['authorization'];
  if (adminToken && adminToken === `Bearer ${process.env.ADMIN_TOKEN || 'gula_admin_secret_2024'}`) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Solo admin' });
  }
};

// POST /api/notifications/subscribe - Save a push subscription
router.post('/subscribe', async (req, res) => {
  try {
    const { workerName, subscription } = req.body;
    if (!workerName || !subscription) {
      return res.status(400).json({ error: 'Faltan datos de suscripción' });
    }

    // Upsert based on endpoint (in case they subscribe again from same browser)
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      { workerName, subscription },
      { upsert: true, new: true }
    );

    res.status(201).json({ message: 'Suscripción guardada correctamente' });
  } catch (error) {
    console.error('Error al guardar suscripción push:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/notifications/notify - Manually trigger notifications
router.post('/notify', requireAdmin, async (req, res) => {
  try {
    const { title, body, targetWorkers } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Falta título o cuerpo del mensaje' });
    }

    let query = {};
    if (Array.isArray(targetWorkers) && targetWorkers.length > 0) {
      query = { workerName: { $in: targetWorkers } };
    }

    const subscriptions = await PushSubscription.find(query);
    if (subscriptions.length === 0) {
      return res.status(200).json({ message: 'No hay usuarios suscritos que coincidan' });
    }

    const payload = JSON.stringify({ title, body });
    const promises = subscriptions.map(sub => 
      webpush.sendNotification(sub.subscription, payload).catch(err => {
        console.error('Error al enviar push a', sub.workerName, err);
        // Si el endpoint ha expirado o ya no es válido (410, 404), podríamos borrarlo de la BD
        if (err.statusCode === 410 || err.statusCode === 404) {
          return PushSubscription.deleteOne({ _id: sub._id });
        }
      })
    );

    await Promise.all(promises);

    res.json({ message: `Notificación enviada a ${subscriptions.length} dispositivo(s).` });
  } catch (error) {
    console.error('Error al enviar notificaciones push:', error);
    res.status(500).json({ error: 'Error interno al enviar push' });
  }
});

export default router;
