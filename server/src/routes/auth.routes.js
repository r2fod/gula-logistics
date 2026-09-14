import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminConfig } from '../models/AdminConfig.model.js';
import { signToken, timingSafeStringEqual } from '../utils/authToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = express.Router();

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — long enough for shared "socias" links

// POST /api/auth/login — verifies the admin password and issues a signed token.
// The password itself is never stored in this repo: it lives hashed in MongoDB
// (AdminConfig), seeded once from ADMIN_BOOTSTRAP_PASSWORD (server env only).
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Falta la contraseña' });
    }

    const mongoConnected = mongoose.connection.readyState === 1;
    let tokenVersion = 1;

    if (mongoConnected) {
      let config = await AdminConfig.findOne({ configKey: 'admin' });

      if (!config) {
        // First run: bootstrap the Mongo-stored credential from the server's
        // own environment variable (never committed to the repo).
        const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
        if (!bootstrapPassword) {
          return res.status(503).json({
            error: 'No hay contraseña de administrador configurada. Define ADMIN_BOOTSTRAP_PASSWORD en el servidor para el primer arranque.'
          });
        }
        const passwordHash = await bcrypt.hash(bootstrapPassword, 12);
        config = await AdminConfig.create({ configKey: 'admin', passwordHash });
      }

      const valid = await bcrypt.compare(password, config.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
      tokenVersion = config.tokenVersion;
    } else {
      // Mongo offline fallback (local dev / outage): compare directly against
      // the bootstrap env var. Nothing persists, same spirit as the rest of
      // this app's in-memory fallback mode.
      const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (!bootstrapPassword || !timingSafeStringEqual(password, bootstrapPassword)) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
    }

    const token = signToken({ role: 'admin', v: tokenVersion }, TOKEN_TTL_SECONDS);
    return res.json({ token, expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000 });
  } catch (error) {
    console.error('Error en login de administrador:', error);
    return res.status(500).json({ error: 'Error interno al verificar credenciales' });
  }
});

// POST /api/auth/change-password — lets an authenticated admin rotate the
// password at runtime, so it never needs to be hardcoded or redeployed.
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'Se requiere conexión activa a MongoDB Atlas para cambiar la contraseña de forma permanente' });
    }

    const config = await AdminConfig.findOne({ configKey: 'admin' });
    if (!config) {
      return res.status(404).json({ error: 'No hay configuración de administrador para actualizar' });
    }

    const valid = await bcrypt.compare(currentPassword, config.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'La contraseña actual no es correcta' });
    }

    config.passwordHash = await bcrypt.hash(newPassword, 12);
    config.tokenVersion = (config.tokenVersion || 1) + 1; // revoke every previously issued token/link
    await config.save();

    return res.json({ success: true, message: 'Contraseña actualizada. Todas las sesiones y enlaces anteriores han quedado invalidados.' });
  } catch (error) {
    console.error('Error al cambiar contraseña de administrador:', error);
    return res.status(500).json({ error: 'Error interno al actualizar la contraseña' });
  }
});

export default router;
