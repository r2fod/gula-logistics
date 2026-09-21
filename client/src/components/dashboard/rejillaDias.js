// Reparto de las tarjetas de día del Cuadrante en columnas, según cuántas haya
// (4 de martes a viernes, 5 si hay víspera, 6 o 7 con otros días). Con una rejilla
// fija de 4 columnas, 5 tarjetas dejaban a la última sola en una fila, con un hueco
// enorme al lado. Aquí cada cantidad elige un número de columnas por ancho de
// pantalla que deja las filas llenas, y si aun así queda un hueco la última tarjeta
// se ensancha para ocuparlo. Las clases van completas para que Tailwind las detecte.
//
// Devuelve { contenedor, ultima }: clases de la rejilla y de la ÚLTIMA tarjeta.
const REJILLAS = {
  1: { contenedor: 'grid-cols-1', ultima: '' },
  2: { contenedor: 'grid-cols-1 md:grid-cols-2', ultima: '' },
  3: { contenedor: 'grid-cols-1 md:grid-cols-3', ultima: '' },
  4: { contenedor: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4', ultima: '' },
  // 5: 2 columnas (2+2+1 -> la última ocupa las dos), 3 (3+2 -> la última ocupa dos) y 5 en una fila en pantallas muy anchas.
  5: { contenedor: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5', ultima: 'md:col-span-2 2xl:col-span-1' },
  6: { contenedor: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3', ultima: '' },
  // 7: 2 columnas (la última ocupa las dos), 3 (3+3+1 -> ocupa las tres) y 4 (4+3 -> ocupa dos).
  7: { contenedor: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', ultima: 'md:col-span-2 lg:col-span-3 xl:col-span-2' },
};
const POR_DEFECTO = { contenedor: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4', ultima: '' };

export const rejillaDeDias = (cantidad) => REJILLAS[cantidad] || POR_DEFECTO;
