import { Radio, Calendar, Zap, Truck, TrendingUp, DollarSign, Lock } from 'lucide-react';

// Pestañas del panel de control, en el orden en que se ven.
//
// - id: clave interna (la que va en `?tab=`).
// - alias: otros valores de `?tab=` / `?view=` que abren la misma pestaña.
// - etiqueta: texto en la barra de escritorio; `etiquetaCorta`, en la barra
//   inferior del móvil (solo las pestañas que tienen `etiquetaCorta` salen ahí).
// - colorActiva: clases de la pestaña seleccionada (escritorio) y del texto de
//   la barra inferior; las clases van completas para que Tailwind las detecte.
export const PESTANAS = [
  {
    id: 'live', alias: ['directo'], icono: Radio, animacionIcono: 'animate-pulse', colorIcono: 'text-rose-400',
    etiqueta: 'Actividad en Tiempo Real', etiquetaCorta: 'En Vivo',
    colorActiva: 'bg-emerald-500 shadow-emerald-500/20', colorTextoMovil: 'text-emerald-400',
  },
  {
    id: 'schedule', alias: ['planning', 'cuadrante'], icono: Calendar,
    etiqueta: 'Cuadrante Semanal', etiquetaCorta: 'Cuadrante',
    colorActiva: 'bg-amber-500 shadow-amber-500/20', colorTextoMovil: 'text-amber-400',
  },
  {
    id: 'graph', alias: ['grafo'], icono: Zap, colorIcono: 'text-amber-400',
    etiqueta: 'Grafo & Flujo', etiquetaCorta: 'Grafo',
    colorActiva: 'bg-amber-500 shadow-amber-500/20', colorTextoMovil: 'text-amber-400',
  },
  {
    id: 'logistics', alias: ['flota', 'bodas'], icono: Truck,
    etiqueta: 'Flota & Bodas',
    colorActiva: 'bg-amber-500 shadow-amber-500/20',
  },
  {
    id: 'balances', alias: ['saldos', 'acuerdos'], icono: TrendingUp,
    etiqueta: 'Saldos & Acuerdos', etiquetaCorta: 'Saldos',
    colorActiva: 'bg-amber-500 shadow-amber-500/20', colorTextoMovil: 'text-amber-400',
  },
  {
    id: 'financial', alias: ['financiero', 'resumen'], icono: DollarSign,
    etiqueta: 'Resumen Financiero',
    colorActiva: 'bg-amber-500 shadow-amber-500/20',
  },
  {
    id: 'fichajes', alias: ['fichaje'], icono: Lock, colorIcono: 'text-amber-400',
    etiqueta: 'Historial Fichajes',
    colorActiva: 'bg-amber-500 shadow-amber-500/20',
  },
];

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
