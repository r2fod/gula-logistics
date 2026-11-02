// La agenda de UN trabajador en la semana que ve (vista del trabajador): qué tiene cada
// día, cuál es su próxima tarea, qué día es «hoy» y si un día todavía no ha llegado.
// Funciones puras (sin React): salen de WorkerView.jsx, que pasaba de las 1000 líneas.

import {
  getTaskListForDay, resolveTaskIndex, isTaskEffectivelyDone, isTaskAssignedTo, getDayLabel,
  getWeddingsBadge, getWeekRange, resolveTaskDate, diaDeLaFecha, getNextTaskStart, esTareaActiva,
} from './taskPlanning';
import { getWeddingTaskName } from './eventNaming';
import { tramoDeHorario } from './horarios';
import { mismoNombre } from './nombresTrabajadores';
import { formatTimeShort, formatWeekdayDay } from '../utils/dateUtils';

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const ORDEN_CALENDARIO = [...NOMBRES_DIA.slice(1), NOMBRES_DIA[0]]; // lunes→domingo

// domingo y lunes comparten sundayMonday.tasks bajo un único bucket real ('domingo' es la
// clave de storage): al leer/escribir la lista real (índice, marcar, taskRef) se usa esta.
export const aClaveGuardada = (dayKey) => (dayKey === 'lunes' ? 'domingo' : dayKey);

// Los 7 días de la semana en el orden de Gula: de martes a domingo y el lunes de COLA (el
// día siguiente al domingo) al final. Títulos y números salen de meta.dateRange
// (getDayLabel); 'domingo' agrupa domingo Y lunes (misma lista) y su título lo dice.
export function diasDeLaSemana(semana = {}, ahora = new Date()) {
  const titulo = (key) => getDayLabel(semana, key, ahora);
  const numero = (key) => titulo(key).replace(/^\D+/, '');
  const plan = semana.schedule || {};
  const dia = (key, label, title, badge) => ({ key, label, date: numero(key), title, badge });
  return [
    dia('martes', 'MAR', plan.martes?.title || titulo('martes'), plan.martes?.badge || 'Arranque Flota'),
    dia('miercoles', 'MIÉ', plan.miercoles?.title || titulo('miercoles'), plan.miercoles?.badge || 'Descarga Fincas'),
    dia('jueves', 'JUE', plan.jueves?.title || titulo('jueves'), plan.jueves?.badge || 'Eventos'),
    dia('viernes', 'VIE', plan.viernes?.title || titulo('viernes'), plan.viernes?.badge || 'Cierre Crítico'),
    dia('sabado', 'SÁB', titulo('sabado'), getWeddingsBadge(semana)),
    dia('domingo', 'DOM', `${titulo('domingo')} y ${titulo('lunes')}`, 'Descarga & Vajilla'),
    dia('lunes', 'LUN', titulo('lunes'), 'Devoluciones & Limpieza'),
  ];
}

// Tareas y bodas (activas) de `nombre` en un día.
export function actividadesDelDia(semana = {}, dayKey, nombre) {
  let tasks = [];
  let weddings = [];
  const suya = (t) => isTaskAssignedTo(t, nombre);

  if (['martes', 'miercoles', 'jueves', 'viernes'].includes(dayKey)) {
    tasks = (semana.schedule?.[dayKey]?.tasks || []).filter(suya).filter(esTareaActiva);
  } else if (dayKey === 'sabado') {
    weddings = (semana.saturdaySpecial?.weddings || []).filter(suya).filter(esTareaActiva);
  } else if (dayKey === 'domingo' || dayKey === 'lunes') {
    // La pestaña LUN enseña la misma lista que DOM (antes buscaba en schedule.lunes, que
    // no existe, y salía vacía)…
    tasks = getTaskListForDay(semana, 'domingo').filter(suya).filter(esTareaActiva);
    // …menos lo etiquetado «Domingo» (targetDay): no es del lunes. Las sin etiquetar
    // siguen en ambas (no se sabe cuál es).
    if (dayKey === 'lunes') {
      tasks = tasks.filter(t => !(typeof t === 'object' && String(t.targetDay || '').toLowerCase() === 'domingo'));
    }
  }
  return { tasks, weddings, totalCount: tasks.length + weddings.length };
}

// Cada día de la semana con sus actividades para `nombre`.
export const agendaDeLaSemana = (semana, nombre, ahora = new Date()) =>
  diasDeLaSemana(semana, ahora).map(dia => ({ ...dia, ...actividadesDelDia(semana, dia.key, nombre) }));

// Sin 'lunes' (comparte lista con 'domingo'): para totales y para «Toda la semana», así
// las tareas de domingo/lunes no cuentan ni salen dos veces.
export const sinLunesRepetido = (dias) => dias.filter(d => d.key !== 'lunes');

// La SIGUIENTE tarea: la que empieza antes entre las que ni están hechas ni han
// terminado ya. Antes era «la primera sin completar por orden de día», y una boda de
// sábado ya pasada se quedaba fijada como siguiente para siempre. Se ordena por hora de
// inicio real porque la lista domingo/lunes mezcla los dos días en cualquier orden.
export function proximaTareaDe(semana, dias, ahora = new Date()) {
  const candidatas = [];
  for (const day of sinLunesRepetido(dias)) {
    for (const t of day.tasks) {
      if (!isTaskEffectivelyDone(semana, day.key, t)) candidatas.push({ day, t, isWedding: false });
    }
    for (const w of day.weddings || []) {
      if (!isTaskEffectivelyDone(semana, day.key, w)) candidatas.push({ day, t: w, isWedding: true });
    }
  }
  const inicio = ({ day, t }) => getNextTaskStart(semana, day.key, t, ahora)?.getTime() ?? Infinity;
  // Una tarea con horario que ya terminó no es «la siguiente» aunque nadie la marcara
  // (nada se marca solo por la hora): sin esto, con solo tareas pasadas sin marcar, la
  // puerta de los 5 min no se cerraba nunca. Con fechas ilegibles no se descarta nada
  // (se podría dejar a todos sin poder fichar).
  const fechasLegibles = !!getWeekRange(semana, ahora);
  const conHorario = ({ t }) => typeof t === 'object' && !!tramoDeHorario(t?.timeFrame);
  const pendientes = candidatas.filter(c => !(fechasLegibles && conHorario(c) && inicio(c) === Infinity));
  pendientes.sort((a, b) => {
    const sa = inicio(a);
    const sb = inicio(b);
    return sa === sb ? 0 : sa < sb ? -1 : 1;
  });

  const next = pendientes[0];
  if (!next) return null;
  const { day, t } = next;
  const taskIndex = resolveTaskIndex(semana, day.key, t);
  if (next.isWedding) {
    return {
      isShiftActive: false, dayKey: day.key, dayTitle: day.title, dayBadge: 'Boda Fin de Semana',
      taskName: getWeddingTaskName(t), taskIndex, timeFrame: t.timeFrame, location: t.location,
      rawTask: t, isWedding: true,
    };
  }
  const obj = typeof t === 'object';
  return {
    isShiftActive: false, dayKey: day.key, taskIndex, dayTitle: day.title, dayBadge: day.badge,
    taskName: obj ? t.text : t,
    timeFrame: obj ? t.timeFrame : null,
    location: obj ? t.location : null,
    mapsUrl: obj ? t.mapsUrl : null,
    rawTask: t, isWedding: false,
  };
}

// «Hoy» es el día de ESTA semana que cae hoy por fecha real; si la semana que se ve no es
// la de hoy, no hay «hoy» en ella (null). Antes se miraba solo el nombre del día: el lunes
// 19 marcaba «LUN 26 · HOY». Sin fechas legibles, por nombre del día.
export const diaDeHoy = (semana, ahora = new Date()) =>
  (getWeekRange(semana, ahora) ? diaDeLaFecha(semana, ahora) : NOMBRES_DIA[ahora.getDay()]);

// ¿Todavía no ha llegado este día? (para no fichar por error una tarea de dentro de varios días)
export function esDiaFuturo(semana, dayKey, ahora = new Date()) {
  // Por FECHA REAL cuando la semana tiene fechas legibles: así una semana futura entera
  // sale bloqueada (por día de la semana suelto, el martes de la semana que viene «ya
  // había llegado» un domingo por la noche).
  const fecha = resolveTaskDate(getWeekRange(semana, ahora), dayKey);
  if (fecha) {
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    return fecha.getTime() > hoy.getTime();
  }
  const ordinal = ORDEN_CALENDARIO.indexOf(dayKey);
  const ordinalHoy = ORDEN_CALENDARIO.indexOf(diaDeHoy(semana, ahora));
  if (ordinal === -1 || ordinalHoy === -1) return false;
  // 'domingo' es el último de lunes→domingo: comprobado un lunes, `ordinal > ordinalHoy`
  // lo daría por futuro cuando fue AYER.
  const fueAyer = ((ordinalHoy - ordinal + ORDEN_CALENDARIO.length) % ORDEN_CALENDARIO.length) === 1;
  if (fueAyer) return false;
  return ordinal > ordinalHoy;
}

// Los días a enseñar según la pestaña. En «Toda la semana» (sin el lunes repetido) van
// primero hoy y los que vienen, y al final los ya pasados, para no tener que hacer scroll.
export function diasParaVer(dias, diaElegido, hoy, esFuturo) {
  if (diaElegido !== 'all') return dias.filter(d => d.key === diaElegido);
  const pasado = (key) => key !== hoy && !esFuturo(key);
  return [...sinLunesRepetido(dias)].sort((a, b) => {
    const ap = pasado(a.key);
    const bp = pasado(b.key);
    if (ap && !bp) return 1;
    if (!ap && bp) return -1;
    return 0;
  });
}

// Por qué no se puede fichar todavía (o '' si no hay nada que decir).
export function textoDePuerta({ sinTareasPendientes, inicioPrimeraTarea, ahora = new Date() }) {
  if (sinTareasPendientes) return 'No tienes tareas pendientes ahora';
  if (!inicioPrimeraTarea) return '';
  const abre = new Date(inicioPrimeraTarea.getTime() - 5 * 60 * 1000);
  const hhmm = formatTimeShort(abre);
  return abre.toDateString() === ahora.toDateString()
    ? `Podrás fichar a partir de las ${hhmm}`
    : `Podrás fichar el ${formatWeekdayDay(abre)} a las ${hhmm}`;
}

// «Espera X para fichar»: minutos hasta 5 min antes de la primera tarea (mínimo 1).
export function textoDeEspera(inicioPrimeraTarea, ahora = new Date()) {
  const min = Math.max(1, Math.ceil((inicioPrimeraTarea.getTime() - ahora.getTime()) / 60000 - 5));
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

// Compañeros de la MISMA tarea (de su `assigned`), sin uno mismo, con su ficha y si ya
// han fichado (`fichadosAhora`: nombres con turno abierto).
export const companerosDeTarea = (asignados, yo, equipo = [], fichadosAhora = []) =>
  (asignados || [])
    .filter(name => !mismoNombre(name, yo))
    .map(name => ({
      name,
      profile: equipo.find(w => mismoNombre(w.name, name)),
      isClockedIn: fichadosAhora.some(n => mismoNombre(n, name)),
    }));
