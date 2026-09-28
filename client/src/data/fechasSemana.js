// Fechas e ids de una semana de Gula, sin nada más: lo usan el generador de
// borradores, la anticipación y el planificador. Van aparte del generador (que
// arrastra el optimizador) para que lo ligero no cargue con lo pesado.

// Ids cortos de las tareas por día (m1, mi2, sl3…): domingo y lunes comparten lista.
export const PREFIJO_ID = { martes: 'm', miercoles: 'mi', jueves: 'j', viernes: 'v', domingo: 'sl', lunes: 'sl' };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const fechaLocal = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const aIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const sumarDias = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth(), d.getDate()); r.setDate(r.getDate() + n); return r; };

// Las semanas de Gula van de martes a domingo (+ el lunes de cola). Devuelve el
// martes que abre la semana en la que cae `fecha` (el lunes cuenta como cola de la anterior).
export function martesDeSemana(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const atras = (d.getDay() - 2 + 7) % 7; // martes = 2
  return sumarDias(d, -atras);
}

// "Del 22 al 27 de Septiembre de 2026" / "Del 29 de Septiembre al 4 de Octubre de 2026"
export function formatearRango(inicioMartes) {
  const fin = sumarDias(inicioMartes, 5);
  if (inicioMartes.getMonth() === fin.getMonth()) {
    return `Del ${inicioMartes.getDate()} al ${fin.getDate()} de ${MESES[fin.getMonth()]} de ${fin.getFullYear()}`;
  }
  return `Del ${inicioMartes.getDate()} de ${MESES[inicioMartes.getMonth()]} al ${fin.getDate()} de ${MESES[fin.getMonth()]} de ${fin.getFullYear()}`;
}

export const weekIdParaInicio = (inicioMartes) => `week_auto_${aIso(inicioMartes)}`;
