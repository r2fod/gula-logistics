import { sortEntriesByTimestamp, ZOMBIE_SHIFT_HOURS } from './shiftCalculations';
import { coincideNombre } from './nombresTrabajadores';
import { plano } from '../utils/texto';
import { formatTimeShort, formatDuration } from '../utils/dateUtils';

// Se paga a la media hora más cercana: un turno de menos de 15 min cuenta 0 h y 0 €.
const MINUTOS_SIN_VALOR = 15;
// pairShiftsFromEntries no paga más de esto por turno.
const HORAS_TOPE = 14;
// Dos subtareas iguales seguidas en menos de esto = doble toque.
const SEGUNDOS_DOBLE = 60;

const ms = (e) => new Date(e.timestamp).getTime();

// Revisa los fichajes con la MISMA lógica de emparejar que pairShiftsFromEntries.
// - sobran: no cuentan horas ni dinero (la app ya los ignora): se pueden mandar a la
//   papelera sin que cambie ninguna cuenta.
// - revisar: sí cuentan, pero algo no cuadra: se arreglan editándolos, no borrándolos.
// Cada grupo: { motivo, persona, fichajes, detalle }.
export function revisarFichajes(fichajes = [], ahora = new Date()) {
  const sobran = [];
  const revisar = [];
  const abiertos = {}; // persona → { entrada, subtareas }
  const clave = (nombre) => Object.keys(abiertos).find(k => coincideNombre(k, nombre)) || nombre;

  sortEntriesByTimestamp(fichajes.filter(e => !e.deleted && e.workerName)).forEach(e => {
    const k = clave(e.workerName);
    const abierto = abiertos[k];
    const persona = e.workerName;

    if (e.type === 'entrada') {
      if (abierto) {
        sobran.push({ motivo: 'entrada-tapada', persona, fichajes: [abierto.entrada, ...abierto.subtareas], detalle: `Entrada sin salida: el turno cuenta desde la siguiente (${formatTimeShort(e.timestamp)}).` });
      }
      abiertos[k] = { entrada: e, subtareas: [] };
    } else if (e.type === 'fichaje') {
      const anterior = abierto?.subtareas.at(-1);
      if (!abierto) {
        sobran.push({ motivo: 'subtarea-suelta', persona, fichajes: [e], detalle: 'Tarea fichada sin turno abierto.' });
      } else if (anterior && plano(anterior.taskName) === plano(e.taskName) && ms(e) - ms(anterior) < SEGUNDOS_DOBLE * 1000) {
        sobran.push({ motivo: 'doble', persona, fichajes: [e], detalle: 'La misma tarea fichada dos veces seguidas.' });
      } else {
        abierto.subtareas.push(e);
      }
    } else if (e.type === 'salida') {
      if (!abierto) {
        sobran.push({ motivo: 'salida-suelta', persona, fichajes: [e], detalle: 'Salida sin entrada abierta: no cierra ningún turno.' });
        return;
      }
      delete abiertos[k];
      const duracion = ms(e) - ms(abierto.entrada);
      if (duracion < MINUTOS_SIN_VALOR * 60 * 1000) {
        sobran.push({ motivo: 'turno-vacio', persona, fichajes: [abierto.entrada, ...abierto.subtareas, e], detalle: `Turno de ${formatDuration(duracion)}: cuenta 0 h y 0 €.` });
      } else if (duracion > HORAS_TOPE * 3600 * 1000) {
        revisar.push({ motivo: 'turno-largo', persona, fichajes: [abierto.entrada, e], detalle: `Turno de ${formatDuration(duracion)} y solo se pagan ${HORAS_TOPE} h: ¿se olvidó de fichar la salida?` });
      }
    }
  });

  Object.values(abiertos).forEach(({ entrada }) => {
    const abierta = ahora - new Date(entrada.timestamp);
    if (abierta > ZOMBIE_SHIFT_HOURS * 3600 * 1000) {
      revisar.push({ motivo: 'olvidado', persona: entrada.workerName, fichajes: [entrada], detalle: `Entrada abierta hace ${formatDuration(abierta)}: ¿se olvidó de fichar la salida?` });
    }
  });

  return { sobran, revisar };
}
