// Límite de peticiones por IP para lo que se puede hacer SIN sesión (fichar, borrar un
// fichaje recién hecho, suscribirse a avisos): frena a quien tenga la URL de la API y
// mande peticiones en bucle. En memoria, como el del login (un solo proceso en Render).
// Generoso a propósito: en un evento todo el equipo sale por la misma IP (la wifi del
// sitio) y la cola de fichajes sin conexión reintenta de golpe. Un 429 no pierde nada:
// el móvil guarda el fichaje y lo reintenta más tarde.
export function limitePorIp({ max, ventanaMs, maxIps = 2000 }) {
  const ips = new Map(); // ip -> { cuenta, inicio }
  return function limite(req, res, next) {
    const ahora = Date.now();
    if (ips.size >= maxIps) {
      for (const [ip, v] of ips) if (ahora - v.inicio >= ventanaMs) ips.delete(ip);
    }
    const ip = req.ip || 'desconocida';
    let entrada = ips.get(ip);
    if (!entrada || ahora - entrada.inicio >= ventanaMs) {
      entrada = { cuenta: 0, inicio: ahora };
      ips.set(ip, entrada);
    }
    entrada.cuenta += 1;
    if (entrada.cuenta > max) {
      res.set('Retry-After', String(Math.ceil((entrada.inicio + ventanaMs - ahora) / 1000)));
      return res.status(429).json({ error: 'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.' });
    }
    next();
  };
}
