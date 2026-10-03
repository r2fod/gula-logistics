import { Radio, Calendar, Zap, Truck, TrendingUp, Wallet, ClipboardList } from 'lucide-react';

// Pestañas del panel de control, en el orden en que se ven. Es la ÚNICA lista: la
// barra de escritorio, la barra inferior del móvil y la lectura de la URL salen de aquí.
//
// - id: clave interna (la que va en `?tab=`).
// - alias: otros valores de `?tab=` / `?view=` que abren la misma pestaña.
// - etiqueta: texto en la barra de escritorio; `corta`, en el atajo de la barra
//   inferior del móvil (ver ORDEN_MOVIL).
// - icono: componente de lucide-react.
// - vivo: el icono late (la pestaña de lo que pasa en directo).
// - hover: clase de la animación propia del icono al pasar el ratón (index.css).
// - contador: la etiqueta lleva el número de fichajes.
export const PESTANAS = [
  { id: 'live', alias: ['directo'], etiqueta: 'Actividad en tiempo real', corta: 'En vivo', icono: Radio, vivo: true, hover: 'icono-latido', colorIcono: 'text-emerald-400' },
  { id: 'schedule', alias: ['planning', 'cuadrante'], etiqueta: 'Cuadrante semanal', corta: 'Cuadrante', icono: Calendar, hover: 'icono-pop', colorIcono: 'text-sky-400' },
  { id: 'graph', alias: ['grafo'], etiqueta: 'Grafo y flujo', corta: 'Grafo', icono: Zap, hover: 'icono-destello', colorIcono: 'text-amber-400' },
  { id: 'logistics', alias: ['flota', 'bodas'], etiqueta: 'Flota y bodas', icono: Truck, hover: 'icono-camion', colorIcono: 'text-blue-400' },
  { id: 'balances', alias: ['saldos', 'acuerdos'], etiqueta: 'Saldos y acuerdos', corta: 'Saldos', icono: TrendingUp, hover: 'icono-pop', colorIcono: 'text-emerald-400' },
  { id: 'financial', alias: ['financiero', 'resumen'], etiqueta: 'Resumen financiero', icono: Wallet, hover: 'icono-bamboleo', colorIcono: 'text-amber-500' },
  { id: 'fichajes', alias: ['fichaje'], etiqueta: 'Historial de fichajes', icono: ClipboardList, hover: 'icono-bamboleo', colorIcono: 'text-indigo-400', contador: true },
];

// Atajos de la barra inferior del móvil, en su orden.
export const ORDEN_MOVIL = ['live', 'schedule', 'balances', 'graph'];

export const PESTANA_INICIAL = 'live';

// Qué pestaña abre una URL (`?tab=saldos`, `?view=resumen`, `?socias`...).
// `busqueda` es lo que va tras el "?" ("tab=saldos"); si no se entiende, la inicial.
export function pestanaDesdeUrl(busqueda) {
  const params = new URLSearchParams(busqueda);
  const valor = params.get('tab') || params.get('view');
  const encontrada = PESTANAS.find((p) => p.id === valor || p.alias.includes(valor));
  if (encontrada) return encontrada.id;
  // El enlace de socias abre directamente los saldos.
  if (params.has('socias')) return 'balances';
  return PESTANA_INICIAL;
}

// Deja la pestaña elegida en la barra de direcciones (sin recargar) para que el
// enlace copiado abra la misma. Quita `?socias`, que ya no manda.
export function guardarPestanaEnUrl(id) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    url.searchParams.delete('socias');
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Sin historial (entornos raros): la pestaña funciona igual, solo no queda en la URL.
  }
}
