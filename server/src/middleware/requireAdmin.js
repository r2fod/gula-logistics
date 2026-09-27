import mongoose from 'mongoose';
import { verifyToken } from '../utils/authToken.js';
import { AdminConfig } from '../models/AdminConfig.model.js';

// Guardias de las rutas. Esperan "Authorization: Bearer <token>".
//  · requireAdmin   → solo la sesión de administrador (todo lo que escribe).
//  · requireLectura → administrador o enlace de socias (solo lectura: saldos).
// Cambiar la contraseña sube `tokenVersion` y anula TODO lo emitido antes;
// "anular enlaces de socias" sube `sociasVersion` y anula solo esos.
function crearGuardia(rolesPermitidos, mensaje) {
  return async function guardia(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const payload = verifyToken(token);
    if (!payload || !rolesPermitidos.includes(payload.role)) {
      return res.status(401).json({ error: mensaje });
    }

    try {
      if (mongoose.connection.readyState === 1) {
        const config = await AdminConfig.findOne({ configKey: 'admin' });
        if (config && payload.v !== config.tokenVersion) {
          return res.status(401).json({ error: 'La sesión ha sido revocada (la contraseña cambió). Vuelve a iniciar sesión.' });
        }
        if (config && payload.role === 'socias' && payload.sv !== (config.sociasVersion || 1)) {
          return res.status(401).json({ error: 'Este enlace de socias se ha anulado. Pide uno nuevo al administrador.' });
        }
      }
    } catch (error) {
      console.error('Error verificando versión de sesión:', error);
      // Dejar pasar ante un fallo puntual de la base anularía la revocación: se cierra.
      return res.status(503).json({ error: 'No se pudo verificar la sesión, inténtalo de nuevo' });
    }

    req.admin = payload;
    req.rol = payload.role;
    next();
  };
}

export const requireAdmin = crearGuardia(['admin'], 'Acceso restringido: se requiere sesión de Administrador válida');
export const requireLectura = crearGuardia(['admin', 'socias'], 'Acceso restringido: se requiere sesión de Administrador o enlace de socias válido');
