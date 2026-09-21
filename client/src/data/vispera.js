import { getWeekRange, resolveTaskDate } from './taskPlanning';
import { parseEventAndTask, splitEventNames, esBorradorSemana } from './eventNaming';

// La VÍSPERA de una semana: el lunes anterior a su martes. En Gula el lunes es la
// cola de la semana anterior (sus tareas viven en su lista domingo/lunes), pero lo
// que se hace ese lunes suele ser para los eventos de la semana que empieza al día
// siguiente (cargar el camión de un evento del martes). Esta función encuentra esas
// tareas para poder enseñarlas también en la semana a la que sirven, sin duplicarlas
// ni moverlas: siguen guardadas donde estaban.
//
// Devuelve { fecha, semana, tareas: [{ task, idx }] } o null. Solo cuentan las tareas
// del lunes (targetDay 'Lunes') de una semana NO borrador cuyo evento es uno de los
// eventos (`events`) de esta semana: las devoluciones de la semana anterior no.
const nombresDeEvento = (tarea) => {
  const explicito = parseEventAndTask(tarea.text);
  return [tarea.event, explicito.explicit ? explicito.eventName : null]
    .filter(Boolean)
    .flatMap(n => splitEventNames(n))
    .map(n => String(n).trim().toLowerCase());
};

const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function tareasDeLaVispera(semanas = {}, semana, hoy = new Date()) {
  const rango = getWeekRange(semana, hoy);
  const eventos = new Set((semana?.events || []).map(e => String(e?.name || '').trim().toLowerCase()).filter(Boolean));
  if (!rango || eventos.size === 0) return null;

  const fecha = new Date(rango.start.getFullYear(), rango.start.getMonth(), rango.start.getDate() - 1);
  const previa = Object.values(semanas || {}).find(w => {
    if (!w || w === semana || esBorradorSemana(w)) return false;
    const r = getWeekRange(w, hoy);
    const lunes = r && resolveTaskDate(r, 'lunes');
    return lunes && mismoDia(lunes, fecha);
  });
  if (!previa) return null;

  const tareas = (previa.sundayMonday?.tasks || [])
    .map((task, idx) => ({ task, idx }))
    .filter(({ task }) => task && typeof task === 'object' && String(task.targetDay || '').toLowerCase() === 'lunes'
      && nombresDeEvento(task).some(n => eventos.has(n)));
  return tareas.length ? { fecha, semana: previa, tareas } : null;
}
