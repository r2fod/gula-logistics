// Trae en segundo plano, con el navegador ya ocioso, lo que se baja bajo demanda
// (`cargas`: funciones `() => import(…)`), para que al usarlo ya esté. No lo hace sin
// red ni con el ahorro de datos del móvil activado. Devuelve cómo cancelarlo.
let enCurso = 0;

// ¿Hay una precarga a medias? Si una falla (se fue la red) no es motivo para recargar
// la página, como sí lo es cuando falla lo que el usuario acaba de pedir (main.jsx).
export const hayPrecargaEnCurso = () => enCurso > 0;

export function precargarEnReposo(cargas = [], esperaMs = 2500) {
  if (typeof navigator !== 'undefined' && (navigator.onLine === false || navigator.connection?.saveData)) return () => {};
  const traer = () => cargas.forEach((cargar) => {
    enCurso += 1;
    cargar().catch(() => { /* sin red: se bajará al usarlo */ }).finally(() => { enCurso -= 1; });
  });
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(traer, { timeout: esperaMs * 2 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(traer, esperaMs);
  return () => clearTimeout(id);
}
