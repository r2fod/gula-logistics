import mongoose from 'mongoose';

// Con MONGODB_URI, ninguna petición se atiende sin base: el servidor empieza a escuchar
// antes de conectar (Render lo despierta con la primera petición, que suele ser fichar) y
// las rutas, al verla desconectada, guardaban en su respaldo en memoria y respondían 201.
// El móvil daba el fichaje por guardado y se perdía al reiniciar. Ahora se espera a que
// conecte (lo normal al despertar: unos segundos) y, si no llega, 503: el cliente lo deja
// en su cola y lo reintenta. Sin MONGODB_URI (desarrollo) sigue el respaldo en memoria.
export const ESPERA_MAXIMA_MS = 15000;

const conectada = () => mongoose.connection.readyState === 1;

function esperarConexion(ms) {
  if (conectada()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const listo = () => { clearTimeout(reloj); resolve(true); };
    const reloj = setTimeout(() => { mongoose.connection.off('connected', listo); resolve(conectada()); }, ms);
    mongoose.connection.once('connected', listo);
  });
}

export function esperarBaseDeDatos({ esperaMs = ESPERA_MAXIMA_MS } = {}) {
  return async function (req, res, next) {
    if (!process.env.MONGODB_URI || conectada()) return next();
    if (await esperarConexion(esperaMs)) return next();
    return res.status(503).json({ error: 'Base de datos no disponible, inténtalo en unos segundos' });
  };
}
