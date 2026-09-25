import { getWeddingTaskName } from './eventNaming';

// El domingo y el lunes comparten UNA sola lista de tareas (sundayMonday.tasks)
// en vez de vivir cada uno en schedule.domingo/schedule.lunes — de hecho
// schedule.domingo ni existe. Este mismo caso especial se repetía suelto en
// varios sitios (WorkerView, App.jsx) y ya causó un bug real: se arregló en
// un sitio y no en los demás, así que el domingo se quedaba sin poder
// completarse. A partir de ahora esta es la ÚNICA fuente de verdad sobre
// dónde vive la lista de tareas de un día — todo el mundo debe usar esto en
// vez de repetir el `dayKey === 'domingo'` a mano.
// `'sundayMonday'` es alias de `'domingo'`: mismo dato (weekData.sundayMonday
// .tasks), pero es el nombre del propio campo en Mongo y el que usa el editor
// de admin (AdminTaskEditorModal) como su dayKey interno, al no separar
// domingo/lunes en pestañas distintas como sí hace el resto de la app.
export function getTaskListForDay(weekData, dayKey) {
  if (!weekData) return [];
  if (dayKey === 'sabado') return weekData.saturdaySpecial?.weddings || [];
  return (dayKey === 'domingo' || dayKey === 'sundayMonday')
    ? (weekData.sundayMonday?.tasks || [])
    : (weekData.schedule?.[dayKey]?.tasks || []);
}

// Busca el índice REAL de una tarea por su texto dentro de la lista completa
// de su día de origen. Necesario porque las listas que se muestran en
// pantalla suelen estar filtradas (por trabajador asignado, por completada,
// etc.), así que el índice visible ahí nunca es el índice real en Mongo.
export function resolveTaskIndexByText(weekData, dayKey, taskText) {
  const list = getTaskListForDay(weekData, dayKey);
  const idx = list.findIndex(t => {
    if (dayKey === 'sabado') return getWeddingTaskName(t) === taskText || t.location === taskText;
    return (typeof t === 'object' ? t.text : t) === taskText;
  });
  return idx !== -1 ? idx : null;
}

// Construye el fragmento de actualización con la forma correcta para
// guardar de vuelta una lista de tareas ya modificada de un día, según si
// es domingo/lunes (bajo la clave `sundayMonday`) o un día normal (bajo
// `schedule[dayKey]`). Combinar con `{ ...weekData, ...patch }`.
export function buildTaskListPatch(weekData, dayKey, updatedList) {
  if (dayKey === 'sabado') {
    return { saturdaySpecial: { ...weekData.saturdaySpecial, weddings: updatedList } };
  }
  return (dayKey === 'domingo' || dayKey === 'sundayMonday')
    ? { sundayMonday: { ...weekData.sundayMonday, tasks: updatedList } }
    : { schedule: { ...weekData.schedule, [dayKey]: { ...weekData.schedule?.[dayKey], tasks: updatedList } } };
}

// Margen compartido: cuánto esperar después de la hora prevista de fin
// antes de dar una tarea por pasada de verdad, tanto para mostrarla como
// "completada" en Actividad en Tiempo Real como para guardarlo en Mongo
// (autoCompletePastTasks en useWeeks.js). Un solo número para no tener que
// mantener dos criterios de "cuánto es razonable de retraso" por separado.
export const TASK_COMPLETION_GRACE_MINUTES = 45;

// `graceMinutes` (por defecto 0, igual que siempre) es el margen que hay
// que dejar pasar DESPUÉS de la hora prevista de fin antes de dar la tarea
// por pasada. Existe porque los horarios del planning son una estimación —
// una boda real que se alarga 10-15min de lo previsto no debería marcarse
// como terminada al segundo exacto. Con grace=0 (el valor que usan todas
// las llamadas existentes, solo para mostrarla tachada en pantalla) el
// comportamiento es exactamente el de siempre; un grace>0 es para
// decisiones que SÍ se guardan (auto-completar de verdad en Mongo, ver
// autoCompletePastTasks en useWeeks.js), donde una falsa alarma pesa más.
export function isTaskChronologicallyPast(dayKey, timeFrame, overrideTime = new Date(), graceMinutes = 0) {
  const weekDayOrder = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const todayKey = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][overrideTime.getDay()];
  const todayOrdinal = weekDayOrder.indexOf(todayKey);
  const ordinal = weekDayOrder.indexOf(dayKey);

  if (ordinal < 0 || todayOrdinal < 0) return false;

  // "Ayer exactamente" (con wraparound: lunes es "el día después" de
  // domingo) es el único caso ambiguo con margen — un turno de ayer que
  // cruza medianoche (ej. una boda 20:30-00:30) puede seguir vigente ya
  // entrado el día siguiente. Dos o más días atrás no tiene ambigüedad
  // posible, se da por pasada sin más (igual que siempre).
  const isExactlyYesterday = ((todayOrdinal - ordinal + 7) % 7) === 1;

  // BUG real (encontrado el 20/09): 'domingo' es el ÚLTIMO elemento de
  // weekDayOrder (ordinal 6, el más alto), así que al comprobar una tarea
  // de domingo ya en lunes, `ordinal > todayOrdinal` (6 > 0) se cumplía y
  // cortaba aquí ANTES de llegar a isExactlyYesterday — una boda de domingo
  // que cruza medianoche se trataba como "día futuro" para siempre, nunca
  // se marcaba pasada ni fichando ya el lunes. Con sábado->domingo (5 y 6)
  // no pasaba porque 5 no es mayor que 6 — por eso ese caso sí estaba
  // cubierto por los tests existentes y este no se detectó antes.
  if (ordinal > todayOrdinal && !isExactlyYesterday) return false; // Future day
  if (ordinal < todayOrdinal && !isExactlyYesterday) return true;

  if (!timeFrame) {
    if (isExactlyYesterday && graceMinutes > 0) {
      const minutesSinceMidnight = overrideTime.getHours() * 60 + overrideTime.getMinutes();
      return minutesSinceMidnight >= graceMinutes;
    }
    return isExactlyYesterday; // Mismo comportamiento de siempre en los demás casos
  }

  const parts = timeFrame.split('-');
  if (parts.length !== 2) return isExactlyYesterday;
  const timeParts = parts[1].trim().split(':');
  if (timeParts.length !== 2) return isExactlyYesterday;

  let endHours = parseInt(timeParts[0], 10);
  const endMinutes = parseInt(timeParts[1], 10);
  // BUG real (encontrado en vivo — autoCompletePastTasks marcó TODAS las
  // tareas de domingo/lunes como completadas de madrugada sin haber pasado
  // su hora): esta condición debe mirar si la PROPIA tarea cruza medianoche
  // (su hora de fin es de madrugada), no aplicarse a cualquier tarea solo
  // porque "ahora" sea de madrugada. Antes bastaba con comprobar el reloj
  // actual, así que una tarea normal de tarde (ej. "15:00-17:00")
  // comprobada a las 02:00 del mismo día se marcaba como pasada por error
  // (currentHours pasaba a 26, muy por encima de endTotal).
  const endCrossesMidnight = endHours < 5;
  if (endCrossesMidnight) endHours += 24; // "00:30" -> "24:30" (cruza medianoche)
  const endTotal = endHours * 60 + endMinutes;

  // currentTotal en la misma escala que endTotal (minutos desde la
  // medianoche de INICIO del día de la tarea): si ya estamos en el día
  // siguiente, se suman 24h para seguir comparando en la misma línea de
  // tiempo continua que un turno que cruza medianoche.
  let currentHours = overrideTime.getHours();
  const currentMinutes = overrideTime.getMinutes();
  if (isExactlyYesterday) {
    currentHours += 24;
  } else if (endCrossesMidnight && currentHours < 5) {
    // Solo si la PROPIA tarea cruza medianoche y "ahora" cae en la franja
    // de madrugada de ese mismo turno (ej. tarea 20:30-00:30 comprobada a
    // las 00:15) — nunca para una tarea normal de tarde.
    currentHours += 24;
  }
  const currentTotal = currentHours * 60 + currentMinutes;

  return currentTotal > endTotal + graceMinutes;
}

// ─── Evaluación por FECHA REAL de la semana ─────────────────────────────────
// isTaskChronologicallyPast (arriba) compara solo el DÍA DE LA SEMANA de hoy
// contra el de la tarea, sin saber a qué semana del calendario pertenece el
// planning. Eso causaba marcados falsos de tareas como "hechas":
//   · Una semana futura (p.ej. la que se prepara el domingo para la
//     siguiente) tenía martes-sábado "ya pasados" desde el minuto uno,
//     porque hoy es domingo — y autoCompletePastTasks las marcaba en Mongo.
//   · domingo/lunes comparten lista (sundayMonday.tasks); sin `targetDay`
//     una tarea se evaluaba siempre como DOMINGO, así que las devoluciones
//     del lunes se marcaban hechas el propio domingo por la mañana.
// Aquí se resuelve la fecha exacta de cada tarea a partir del texto de
// meta.dateRange de la semana y se compara contra "ahora" — sin ordinales,
// sin wraparound. Si no se puede determinar la fecha (dateRange ilegible),
// NO se marca ni se tacha nada: dejar una tarea pendiente de más es
// inocuo, darla por hecha sin estarlo no.

const MONTHS = {
  enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2, abril: 3, abr: 3,
  mayo: 4, may: 4, junio: 5, jun: 5, julio: 6, jul: 6, agosto: 7, ago: 7,
  septiembre: 8, setiembre: 8, sept: 8, sep: 8, octubre: 9, oct: 9,
  noviembre: 10, nov: 10, diciembre: 11, dic: 11,
};
const MONTH_WORDS = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const JS_WEEKDAY = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

function buildDate(year, month, day) {
  const d = new Date(year, month, day);
  return d.getMonth() === month && d.getDate() === day ? d : null;
}

// Devuelve { start, end } (Date a las 00:00 locales) o null si no se puede
// determinar con seguridad. Acepta "Del 15 al 20 de Septiembre de 2026",
// "Del 22 al 27 de Septiembre" (año = el que deje la fecha más cerca de
// ahora) y "Del 29 de Septiembre al 4 de Octubre". Se valida que el rango
// dure entre 3 y 8 días: un texto raro que se leyera mal (p.ej. "Semana 4,
// del 22 al 27") NO debe dar unas fechas inventadas.
export function parseWeekRange(dateRange, now = new Date()) {
  if (typeof dateRange !== 'string') return null;
  const text = dateRange.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const yearMatch = text.match(/\b(20\d{2})\b/);
  const body = yearMatch ? text.replace(yearMatch[0], ' ') : text;

  const numbers = [...body.matchAll(/\b(\d{1,2})\b/g)].map(m => Number(m[1]));
  const months = [...body.matchAll(new RegExp(`\\b(${MONTH_WORDS})\\b`, 'g'))].map(m => MONTHS[m[1]]);
  if (numbers.length < 2 || months.length < 1) return null;

  const [d1, d2] = numbers;
  const m1 = months[0];
  const m2 = months.length > 1 ? months[1] : m1;

  const crossesYear = m2 < m1;
  // Con año explícito ("... al 3 de Enero de 2027") ese año es el del FINAL
  // del rango; sin año se prueban los vecinos y gana el más cercano a hoy.
  const candidateStartYears = yearMatch
    ? [Number(yearMatch[1]) - (crossesYear ? 1 : 0)]
    : [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  let best = null;
  for (const y of candidateStartYears) {
    const start = buildDate(y, m1, d1);
    const end = buildDate(crossesYear ? y + 1 : y, m2, d2);
    if (!start || !end) continue;
    const span = Math.round((end - start) / DAY_MS);
    if (span < 3 || span > 8) continue;
    if (!best || Math.abs(start - now) < Math.abs(best.start - now)) best = { start, end };
  }
  return best;
}

export function getWeekRange(weekData, now = new Date()) {
  return parseWeekRange(weekData?.meta?.dateRange, now);
}

// Fecha real (Date a las 00:00) de un dayKey dentro de la semana. 'lunes' es
// el lunes que SIGUE al domingo de esa semana (la lista domingo/lunes es la
// cola de la semana, no su inicio).
export function resolveTaskDate(range, dayKey) {
  if (!range || !(dayKey in JS_WEEKDAY)) return null;
  const offsetTo = (weekday) => (weekday - range.start.getDay() + 7) % 7;
  if (dayKey === 'lunes') return addDays(range.start, offsetTo(0) + 1);
  return addDays(range.start, offsetTo(JS_WEEKDAY[dayKey]));
}

// "3 Bodas" para la cabecera del sábado: cuenta FINCAS distintas, no filas
// (una boda suele tener varias: montaje por la mañana y evento por la noche).
export function getWeddingsBadge(weekData) {
  const n = new Set((weekData?.saturdaySpecial?.weddings || []).map(w => w?.location)).size;
  if (n === 0) return 'Sin bodas';
  return n === 1 ? '1 Boda' : `${n} Bodas`;
}

const DAY_NAMES = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };

// "Martes 15" con el número REAL del día según meta.dateRange de la semana
// activa. Sin fechas legibles devuelve solo el nombre ("Martes"): mejor no
// poner número que poner el de otra semana (había "Lunes 14 ... Domingo 20"
// escritos a mano en WorkerView y TaskFlowGraphView).
export function getDayLabel(weekData, dayKey, now = new Date()) {
  const name = DAY_NAMES[dayKey];
  if (!name) return dayKey;
  const date = resolveTaskDate(getWeekRange(weekData, now), dayKey);
  return date ? `${name} ${date.getDate()}` : name;
}

// Día de calendario REAL con el que hay que evaluar una tarea. Para días
// normales y bodas es el propio dayKey. Para la lista compartida
// domingo/lunes manda el `targetDay` de la tarea; SIN targetDay es ambiguo
// (puede ser domingo o lunes) y se evalúa como LUNES — el último día
// posible — porque marcar como hecha una tarea que no lo está es peor que
// dejarla pendiente un poco más (un trabajador o el admin siempre puede
// marcarla a mano, o al fichar su salida).
export function resolveTaskEvalDay(dayKey, task) {
  if (dayKey !== 'domingo' && dayKey !== 'lunes' && dayKey !== 'sundayMonday') return dayKey;
  const target = (task && typeof task === 'object' && task.targetDay) ? String(task.targetDay).toLowerCase() : null;
  if (target === 'domingo' || target === 'lunes') return target;
  return 'lunes';
}

function parseEndDateTime(date, timeFrame) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*$/.exec(typeof timeFrame === 'string' ? timeFrame : '');
  if (!m) return null;
  const [sh, sm, eh, em] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (sh > 23 || eh > 23 || sm > 59 || em > 59) return null;
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
  if (eh * 60 + em <= sh * 60 + sm) end.setDate(end.getDate() + 1); // cruza medianoche
  return end;
}

// true / false = decidido por fechas reales. null = NO se puede decidir
// (semana sin fechas legibles) — quien escribe en Mongo debe abstenerse.
// Una tarea sin horario "HH:MM - HH:MM" utilizable devuelve false: el reloj
// no puede decir que terminó (antes se daban por hechas al acabar el día).
export function getTaskPastStatus(weekData, dayKey, task, now = new Date(), graceMinutes = 0) {
  const range = getWeekRange(weekData, now);
  if (!range) return null;
  const date = resolveTaskDate(range, resolveTaskEvalDay(dayKey, task));
  if (!date) return null;
  const timeFrame = (task && typeof task === 'object') ? task.timeFrame : null;
  const end = parseEndDateTime(date, timeFrame);
  if (!end) return false;
  return now.getTime() > end.getTime() + graceMinutes * 60 * 1000;
}

// Momento REAL (Date) en que EMPIEZA una tarea, según la fecha de su día en
// la semana y la hora de inicio de su horario. null si no se puede saber
// (fechas de la semana ilegibles u horario sin "HH:MM").
export function getTaskStartDateTime(weekData, dayKey, task, now = new Date()) {
  const range = getWeekRange(weekData, now);
  if (!range) return null;
  const date = resolveTaskDate(range, resolveTaskEvalDay(dayKey, task));
  const timeFrame = (task && typeof task === 'object') ? task.timeFrame : null;
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(typeof timeFrame === 'string' ? timeFrame : '');
  if (!date || !m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Number(m[1]), Number(m[2]));
}

// Tramo REAL { start, end } (Date) de una tarea: la fecha de su día más su
// horario "HH:MM - HH:MM" (si acaba antes de empezar, cruza medianoche). null
// si no se puede saber (fechas de la semana ilegibles u horario sin "HH:MM").
export function getTaskInterval(weekData, dayKey, task, now = new Date()) {
  const start = getTaskStartDateTime(weekData, dayKey, task, now);
  const range = getWeekRange(weekData, now);
  if (!start || !range) return null;
  const date = resolveTaskDate(range, resolveTaskEvalDay(dayKey, task));
  const end = parseEndDateTime(date, task.timeFrame);
  return end ? { start, end } : null;
}

// Próximo momento en que EMPIEZA una tarea (Date) o null si ya no puede
// ocurrir / no se sabe. Para una tarea con día fijo es el suyo. Una tarea de
// la lista domingo/lunes SIN etiquetar puede ser de cualquiera de los dos:
// se toma la primera ocurrencia que todavía no ha terminado (a las 14:00 del
// domingo, una de 09:00 es la del lunes; a las 08:00 del domingo, la del
// mismo domingo). Así una tarea sin etiquetar ni bloquea el domingo ni se
// puede fichar de madrugada del lunes por una hora que ya pasó ayer.
export function getNextTaskStart(weekData, dayKey, task, now = new Date()) {
  const range = getWeekRange(weekData, now);
  const timeFrame = (task && typeof task === 'object') ? task.timeFrame : null;
  if (!range || typeof timeFrame !== 'string') return null;
  const sharedList = dayKey === 'domingo' || dayKey === 'lunes' || dayKey === 'sundayMonday';
  const ambiguous = sharedList && !['domingo', 'lunes'].includes(String(task?.targetDay || '').toLowerCase());
  const days = ambiguous ? ['domingo', 'lunes'] : [resolveTaskEvalDay(dayKey, task)];

  let best = null;
  for (const day of days) {
    const date = resolveTaskDate(range, day);
    const start = date && getTaskStartDateTime(weekData, day, { ...task, targetDay: day }, now);
    const end = date && parseEndDateTime(date, timeFrame);
    if (!start || !end || end.getTime() <= now.getTime()) continue;
    if (!best || start < best) best = start;
  }
  return best;
}

// La jornada solo se puede EMPEZAR (primer fichaje del día) desde
// `earlyMinutes` antes de que empiece la primera tarea — evita fichar de
// madrugada una tarea de las 09:00. NO se aplica tarea a tarea: quien ya
// está trabajando puede cambiar de tarea cuando quiera. Por fecha real: antes
// solo se miraba si la tarea era "de hoy" por día de la semana, así que una
// de lunes sin etiquetar se podía fichar el domingo, o cualquiera de una
// semana futura. Sin fecha u hora legible NO se bloquea (mejor dejar fichar
// que impedir trabajar por un dato mal escrito).
export function isTaskTooEarlyToStart(weekData, dayKey, task, now = new Date(), earlyMinutes = 5) {
  const start = getNextTaskStart(weekData, dayKey, task, now);
  if (!start) return false;
  return now.getTime() < start.getTime() - earlyMinutes * 60 * 1000;
}

// Versión para PINTAR (tachado) y filtrar: solo true cuando las fechas reales
// dicen que la tarea ya terminó. Con fechas ilegibles (null) o sin horario
// utilizable no se da por pasada.
export function isTaskPast(weekData, dayKey, task, now = new Date(), graceMinutes = 0) {
  return getTaskPastStatus(weekData, dayKey, task, now, graceMinutes) === true;
}

// ¿Se da la tarea por hecha? ÚNICA fuente de verdad para lo que se ve (tachado
// y check), lo que hace un clic y lo que se guarda solo:
//   · `completed: true` -> hecha (alguien la marcó, o se fichó su salida).
//   · `reopened: true`  -> alguien la DESMARCÓ a propósito: el reloj ya no la
//     vuelve a dar por hecha (antes se volvía a marcar sola a los 45 min y
//     "no dejaba desmarcar").
//   · si no, hecha cuando pasó su hora + margen (TASK_COMPLETION_GRACE_MINUTES).
// El mismo margen para verla y para guardarla: antes se TACHABA al acabar su
// hora exacta pero no se guardaba hasta 45 min después, y como el clic
// actuaba sobre el dato (no sobre lo que se veía), pulsar una tarea tachada
// la MARCABA de verdad en vez de desmarcarla.
export function isTaskEffectivelyDone(weekData, dayKey, task, now = new Date(), graceMinutes = TASK_COMPLETION_GRACE_MINUTES) {
  if (task && typeof task === 'object') {
    if (task.completed) return true;
    if (task.reopened) return false;
  }
  // A petición del usuario, las tareas YA NO se marcan solas cuando pasa su hora.
  // Solo se marcan cuando los chicos hacen clic en ellas.
  // if (isWeekFinished(weekData, now, graceMinutes)) return true;
  // return isTaskPast(weekData, dayKey, task, now, graceMinutes);
  return false;
}

// ¿Ha terminado la semana? Sí cuando ya pasó su último día (el domingo del
// rango) y NO queda ninguna tarea con horario por hacer (el lunes de cola sigue
// vivo hasta que pasan sus horas + margen). Un borrador nunca termina. Sin
// fechas legibles, no se puede decir: false.
const TIENE_HORARIO = /^\s*\d{1,2}:\d{2}\s*[-–—]\s*\d{1,2}:\d{2}\s*$/;
const cacheFinalizada = new WeakMap();

function todasLasTareas(weekData) {
  const out = [];
  Object.entries(weekData?.schedule || {}).forEach(([dia, d]) => (d?.tasks || []).forEach(t => out.push(['' + dia, t])));
  (weekData?.saturdaySpecial?.weddings || []).forEach(t => out.push(['sabado', t]));
  (weekData?.sundayMonday?.tasks || []).forEach(t => out.push(['domingo', t]));
  return out;
}

export function isWeekFinished(weekData, now = new Date(), graceMinutes = TASK_COMPLETION_GRACE_MINUTES) {
  if (!weekData || weekData.meta?.status === 'Borrador') return false;
  const minuto = Math.floor(now.getTime() / 60000);
  const cache = cacheFinalizada.get(weekData);
  if (cache && cache.minuto === minuto && cache.grace === graceMinutes) return cache.valor;

  let valor = false;
  const range = getWeekRange(weekData, now);
  if (range) {
    const lunesDeCola = addDays(range.end, 1);
    const yaPasoElDomingo = now.getTime() >= lunesDeCola.getTime();
    valor = yaPasoElDomingo && !todasLasTareas(weekData).some(([dia, t]) =>
      t && typeof t === 'object' && TIENE_HORARIO.test(String(t.timeFrame || '')) && getTaskPastStatus(weekData, dia, t, now, graceMinutes) === false);
  }
  cacheFinalizada.set(weekData, { minuto, grace: graceMinutes, valor });
  return valor;
}

// Añade el año al texto del rango si no lo trae ("Del 22 al 27 de Septiembre"
// -> "... de 2026") para que dentro de meses no se lea otro año por cercanía.
// Si el texto no se entiende, se devuelve tal cual.
export function ensureYearInDateRange(dateRange, now = new Date()) {
  if (typeof dateRange !== 'string' || /\b20\d{2}\b/.test(dateRange)) return dateRange;
  const range = parseWeekRange(dateRange, now);
  return range ? `${dateRange.trim()} de ${range.end.getFullYear()}` : dateRange;
}

// Copia de una semana con TODAS las tareas (y camiones) sin completar. Una
// semana nueva creada clonando la actual, o generada por IA, no debe heredar
// los "hecho" de la anterior: llegaría con todo tachado desde el minuto cero.
export function clearWeekCompletion(weekData) {
  const clearList = (list) => (list || []).map(t => {
    if (!t || typeof t !== 'object') return t;
    const limpia = { ...t, completed: false };
    delete limpia.reopened; // el desmarcado a mano tampoco se hereda
    return limpia;
  });
  const cleared = { ...weekData };
  if (weekData.schedule) {
    cleared.schedule = Object.fromEntries(
      Object.entries(weekData.schedule).map(([k, day]) => [k, { ...day, tasks: clearList(day?.tasks) }])
    );
  }
  if (weekData.saturdaySpecial) {
    cleared.saturdaySpecial = { ...weekData.saturdaySpecial, weddings: clearList(weekData.saturdaySpecial.weddings) };
  }
  if (weekData.sundayMonday) {
    cleared.sundayMonday = { ...weekData.sundayMonday, tasks: clearList(weekData.sundayMonday.tasks) };
  }
  if (Array.isArray(weekData.trucks)) {
    cleared.trucks = weekData.trucks.map(t => ({ ...t, pickupCompleted: false, returnCompleted: false }));
  }
  return cleared;
}

// Para el botón "Fichar Esta Tarea" en la vista de trabajador: además de
// que el día ya haya llegado (isDayInFuture en WorkerView.jsx), la tarea
// concreta no se puede fichar hasta `earlyMinutes` antes de su hora de
// inicio — evita fichar por error una tarea de última hora del día nada
// más empezar la jornada. Solo mira el propio día de hoy: una tarea de un
// día ya pasado de la semana (sin completar) no se bloquea por hora, ya
// que el día entero quedó atrás.
export function isTaskTooEarlyToClockIn(dayKey, timeFrame, overrideTime = new Date(), earlyMinutes = 5) {
  if (!timeFrame) return false; // sin horario registrado, no se puede evaluar -> no bloquear

  const todayKey = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][overrideTime.getDay()];
  if (dayKey !== todayKey) return false;

  const startParts = (timeFrame.split('-')[0] || '').trim().split(':');
  if (startParts.length !== 2) return false;
  const startHours = parseInt(startParts[0], 10);
  const startMinutes = parseInt(startParts[1], 10);
  if (Number.isNaN(startHours) || Number.isNaN(startMinutes)) return false;

  const startTotal = startHours * 60 + startMinutes;
  const nowTotal = overrideTime.getHours() * 60 + overrideTime.getMinutes();
  return nowTotal < startTotal - earlyMinutes;
}

// Texto de una tarea normal o de una boda del sábado (para mostrarlo o buscar en él).
export function getTaskText(task) {
  if (typeof task === 'string') return task;
  if (!task) return '';
  if (typeof task.text === 'string') return task.text;
  if (task.location) return task.truck ? getWeddingTaskName(task) : `Boda: ${task.location}`;
  return '';
}

// ¿Es esta tarea (o boda) de esta persona? Manda la lista `assigned` de la tarea, con
// el nombre exacto del equipo (sin distinguir mayúsculas). Solo si la tarea no trae
// `assigned` (dato antiguo) se busca el nombre en su texto y en los datos de la boda.
export function isTaskAssignedTo(task, workerName) {
  const nombre = String(workerName || '').toLowerCase();
  if (!nombre) return false;
  if (task && typeof task === 'object' && Array.isArray(task.assigned) && task.assigned.length > 0) {
    return task.assigned.some((a) => String(a).toLowerCase() === nombre);
  }
  const texto = task && typeof task === 'object'
    ? [task.text, task.location, task.details, task.truck].filter(Boolean).join(' ')
    : String(task || '');
  return texto.toLowerCase().includes(nombre);
}
