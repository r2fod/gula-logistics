// Render (plan gratuito) duerme el servidor a los 15 min sin peticiones de fuera y tarda
// cerca de un minuto en despertar. Mientras está en marcha, el propio servidor se llama
// por su dirección pública cada 10 min: la petición sale a internet y vuelve a entrar
// por Render como cualquier otra. No hace falta ningún servicio externo (el keep-alive
// de GitHub se ejecuta cada 3–5 h y un aviso externo no sirvió). No es seguro que
// Render lo cuente como actividad: se comprueba con `activoDesde` de /api/health (si
// tras una noche sin uso sigue siendo de ayer, no se ha dormido).
//
// Solo en Render (RENDER_EXTERNAL_URL lo pone él) y se apaga con MANTENER_DESPIERTO=no.
// Despierto todo el mes gasta ~744 de las 750 h gratuitas de la cuenta.
const CADA_MS = 10 * 60 * 1000;

export function mantenerDespierto({ url = process.env.RENDER_EXTERNAL_URL, cadaMs = CADA_MS, pedir = fetch } = {}) {
  if (!url || process.env.MANTENER_DESPIERTO === 'no') return null;
  const llamar = () => {
    Promise.resolve()
      .then(() => pedir(`${url.replace(/\/+$/, '')}/api/health`, { signal: AbortSignal.timeout(20000) }))
      .catch(() => { /* un fallo suelto no importa: se repite en 10 min */ });
  };
  const reloj = setInterval(llamar, cadaMs);
  reloj.unref?.();
  return reloj;
}
