import mongoose from 'mongoose';
import { verifyToken } from '../utils/authToken.js';
import { AdminConfig } from '../models/AdminConfig.model.js';

// Protects mutating / sensitive routes. Expects "Authorization: Bearer <token>".
export async function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return res.status(401).json({ error: 'Acceso restringido: se requiere sesión de Administrador válida' });
  }

  // A password change bumps tokenVersion, which immediately revokes every
  // previously issued token (including long-lived shared "socias" links).
  try {
    if (mongoose.connection.readyState === 1) {
      const config = await AdminConfig.findOne({ configKey: 'admin' });
      if (config && payload.v !== config.tokenVersion) {
        return res.status(401).json({ error: 'La sesión ha sido revocada (la contraseña cambió). Vuelve a iniciar sesión.' });
      }
    }
  } catch (error) {
    console.error('Error verificando versión de sesión de administrador:', error);
    // Fail open on a transient DB read here would defeat revocation, so fail closed.
    return res.status(503).json({ error: 'No se pudo verificar la sesión, inténtalo de nuevo' });
  }

  req.admin = payload;
  next();
}
