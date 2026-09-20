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
    if (dayKey === 'sabado') return `Boda: ${t.location} (${t.truck})` === taskText || t.location === taskText;
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
