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
    id: crypto.randomUUID(),
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
