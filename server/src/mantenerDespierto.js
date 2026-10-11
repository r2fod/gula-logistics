// Render (plan gratuito) duerme el servidor tras 15 min sin visitas y tarda ~1 min en
// despertar. Sin servicios externos: el propio servidor se llama por su dirección
// PÚBLICA cada 10 min (una llamada a localhost no sale de la máquina y no cuenta como
// visita). Lo mantiene despierto mientras está encendido, y arranca con cada despliegue
// o reinicio. Solo en Render; se apaga con MANTENER_DESPIERTO=no. Despierto todo el mes
// gasta ~744 de las 750 h gratis de la cuenta: con otro servicio gratuito activo en la
// misma cuenta de Render, apagarlo (si se pasan, Render suspende todos hasta el mes siguiente).
export const CADA_MS = 10 * 60 * 1000;

// La dirección a la que llamarse, o null (fuera de Render o apagado).
export function urlDeLatido(env = process.env) {
  if (env.MANTENER_DESPIERTO === 'no') return null;
  const base = env.RENDER_EXTERNAL_URL || (env.RENDER ? 'https://gula-logistics.onrender.com' : '');
  return base ? `${base.replace(/\/+$/, '')}/api/health` : null;
}

// Empieza a llamarse cada `cadaMs`; devuelve el temporizador (o null si no toca).
export function mantenerDespierto({ env = process.env, llamar = fetch, cadaMs = CADA_MS } = {}) {
  const url = urlDeLatido(env);
  if (!url) return null;
  const reloj = setInterval(() => {
    // Un fallo suelto no importa: la siguiente llega antes de los 15 min.
    Promise.resolve().then(() => llamar(url, { signal: AbortSignal.timeout(30 * 1000) })).catch(() => {});
  }, cadaMs);
  reloj.unref?.(); // no retiene el proceso (lo mantiene vivo el servidor HTTP)
  console.log(`Mantener despierto: ${url} cada ${Math.round(cadaMs / 60000)} min`);
  return reloj;
}
