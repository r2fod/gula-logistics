import mongoose from 'mongoose';
import { verifyToken } from '../utils/authToken.js';
import { AdminConfig } from '../models/AdminConfig.model.js';

// Guardias de las rutas. Esperan "Authorization: Bearer <token>".
//  · requireAdmin   → solo la sesión de administrador (todo lo que escribe).
//  · requireLectura → administrador o enlace de socias (solo lectura: saldos).
//  · requireTrabajador → enlace firmado de UN trabajador (`w` = id de su ficha de
//    Saldos): solo sirve para leer lo suyo (GET /api/balances/mio).
// Cambiar la contraseña sube `tokenVersion` y anula TODO lo emitido antes, salvo los
// enlaces de trabajador, que van con su propia versión (`trabajadoresVersion`);
// "anular enlaces de socias" sube `sociasVersion` y anula solo esos.
const tokenDe = (req) => {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
};

// Por qué ya no vale un token bien firmado (anulado al subir su versión), o null.
// Sin base no se puede comprobar y vale; si la base falla, lanza.
async function motivoDeAnulacion(payload) {
  if (mongoose.connection.readyState !== 1) return null;
  const config = await AdminConfig.findOne({ configKey: 'admin' });
  if (config && payload.role === 'trabajador') {
    if (payload.tv !== (config.trabajadoresVersion || 1)) {
      return 'Este enlace se ha anulado. Pide el nuevo al administrador.';
    }
  } else if (config && payload.v !== config.tokenVersion) {
    return 'La sesión ha sido revocada (la contraseña cambió). Vuelve a iniciar sesión.';
  }
  if (config && payload.role === 'socias' && payload.sv !== (config.sociasVersion || 1)) {
    return 'Este enlace de socias se ha anulado. Pide uno nuevo al administrador.';
  }
  return null;
}

function crearGuardia(rolesPermitidos, mensaje) {
  return async function guardia(req, res, next) {
    const payload = verifyToken(tokenDe(req));
    if (!payload || !rolesPermitidos.includes(payload.role)) {
      return res.status(401).json({ error: mensaje });
    }

    try {
      const motivo = await motivoDeAnulacion(payload);
      if (motivo) return res.status(401).json({ error: motivo });
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
export const requireTrabajador = crearGuardia(['trabajador'], 'Este enlace no permite ver el saldo: pide tu enlace nuevo al administrador');

// Para las rutas abiertas que dejan hacer más a un admin (fichajes): ¿trae una sesión
// de admin VIGENTE? Una anulada (contraseña cambiada, «Cerrar todas las sesiones»,
// enlaces viejos de socias con la sesión dentro) o un fallo de la base cuenta como sin sesión.
export async function esAdminVigente(req) {
  const payload = verifyToken(tokenDe(req));
  if (payload?.role !== 'admin') return false;
  try {
    return !(await motivoDeAnulacion(payload));
  } catch {
    return false;
  }
}
