import { formatDate, formatTime } from '../utils/dateUtils';

// Tarifa por hora si quien ficha no trae la suya.
const TARIFA_POR_DEFECTO = 10;

// Crea el registro de un fichaje. Es el ÚNICO sitio que decide cómo se ve por
// dentro: quien ficha (nombre, rol, si es de nómina y su tarifa), la hora exacta
// y sus textos ya formateados en español (24 h).
//
// - trabajador: { name, role, isPayroll, rate }
// - tipo: 'entrada' | 'salida' | 'fichaje' (fichar una tarea concreta)
// - fecha: momento del fichaje (por defecto, ahora).
// - extra: campos de más (taskName, note, taskRef, editedByAdmin...); pisan a los
//   de arriba, así el editor de admin puede conservar el id o poner otra tarifa.
export function crearFichaje({ trabajador, tipo, fecha = new Date(), ...extra }) {
  return {
    // crypto.randomUUID() en vez de Date.now().toString(): dos fichajes que
    // coincidan en el mismo milisegundo (típico si varios empiezan la jornada a
    // la misma hora en punto) chocaban contra el índice único de `id` en Mongo,
    // y el segundo fallaba con un 500 silencioso.
    // Fallback manual para móviles conectados por HTTP (insecure context) donde crypto.randomUUID no existe.
    id: typeof crypto !== 'undefined' && crypto.randomUUID 
      ? crypto.randomUUID() 
      : Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
    workerName: trabajador.name,
    role: trabajador.role,
    isPayroll: trabajador.isPayroll,
    rate: trabajador.rate || TARIFA_POR_DEFECTO,
    type: tipo,
    timestamp: fecha.toISOString(),
    timeFormatted: formatTime(fecha),
    dateFormatted: formatDate(fecha),
    ...extra,
  };
}

// La hora y la fecha que se enseñan de un fichaje salen de su `timestamp`. Los
// textos guardados (`timeFormatted`, `dateFormatted`) solo sirven de recurso para
// fichajes antiguos sin `timestamp` o con uno ilegible.
const tieneFechaValida = (fichaje) => !!fichaje?.timestamp && !Number.isNaN(new Date(fichaje.timestamp).getTime());

export const horaDeFichaje = (fichaje) => (tieneFechaValida(fichaje) ? formatTime(fichaje.timestamp) : fichaje?.timeFormatted);

export const fechaDeFichaje = (fichaje) => (tieneFechaValida(fichaje) ? formatDate(fichaje.timestamp) : fichaje?.dateFormatted);

// Fichajes de una semana del planning. La semana de Gula va de martes a
// domingo MÁS el lunes de cola, así que la ventana es [martes 00:00, martes
// siguiente 00:00) — antes se cortaba el domingo a las 06:00 (fin del rango +
// 6 h) y todo lo del domingo por la mañana en adelante y el lunes quedaba fuera:
// quien fichaba entrada el domingo no aparecía fichado en su propia pantalla.
// Además, la entrada de un turno que SIGUE ABIERTO se incluye siempre, aunque
// empezara antes de la ventana: si no, alguien que entró la noche del lunes y
// sigue trabajando pasado el martes 00:00 dejaría de verse fichado.
// `rango` es el de getWeekRange ({ start, end } a las 00:00); sin rango
// legible se devuelven todos. `abiertos` son las entradas de turnos sin salida
// (activeShifts de pairShiftsFromEntries).
const DIA_MS = 24 * 60 * 60 * 1000;
export function fichajesDeLaSemana(fichajes = [], rango, abiertos = []) {
  if (!rango?.start) return fichajes;
  const desde = rango.start.getTime();
  const hasta = desde + 7 * DIA_MS;
  const idsAbiertos = new Set(abiertos.map(e => e?.id).filter(Boolean));
  return fichajes.filter(e => {
    if (idsAbiertos.has(e.id)) return true;
    const t = new Date(e.timestamp).getTime();
    return !Number.isNaN(t) && t >= desde && t < hasta;
  });
}

// Sincronización por cambios (GET /api/clock?desde=): hasta cuándo se tiene todo
// —el `updatedAt` más reciente que ha mandado el servidor, así no depende del reloj
// del móvil— y cómo meter los cambios en la lista.
export function ultimaModificacion(fichajes = []) {
  let max = null;
  fichajes.forEach(f => {
    const t = f?.updatedAt ? new Date(f.updatedAt).getTime() : NaN;
    if (!Number.isNaN(t) && (max === null || t > max)) max = t;
  });
  return max === null ? null : new Date(max).toISOString();
}

// Sustituye por `id` los que ya estaban y añade al principio los nuevos (el servidor
// los manda del más reciente al más antiguo). Si nada cambia de verdad (mismo
// `updatedAt`), devuelve la MISMA lista: así la pantalla no se recalcula en balde.
export function fusionarCambiosFichajes(actuales = [], cambios = []) {
  const porId = new Map(actuales.map(f => [f.id, f]));
  const reales = (cambios || []).filter(c => c?.id && (!porId.has(c.id) || porId.get(c.id).updatedAt !== c.updatedAt));
  if (!reales.length) return actuales;
  const nuevos = new Map(reales.map(c => [c.id, c]));
  const sustituidos = actuales.map(f => nuevos.get(f.id) || f);
  const anadidos = reales.filter(c => !porId.has(c.id));
  return [...anadidos, ...sustituidos];
}
