import { getWeekRange, resolveTaskDate, resolveTaskEvalDay } from './taskPlanning';
import { esBorradorSemana } from './eventNaming';

// La VÍSPERA de una semana: el lunes anterior a su martes. En Gula el lunes es la
// cola de la semana anterior (sus tareas viven en su lista domingo/lunes), pero ese
// mismo lunes también sirve a la semana que empieza al día siguiente (cargar el camión
// de un evento del martes). Estas funciones enseñan ese lunes COMPLETO en la semana a la
// que sirve, sin duplicar ni mover nada: las tareas siguen guardadas donde estaban.

const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const inicioHora = (task) => {
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(typeof task?.timeFrame === 'string' ? task.timeFrame : '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : Infinity; // sin horario, al final
};

// Clave (en `semanas`) de la semana NO borrador cuyo lunes de cola es la víspera
// de `semana` — el lunes justo anterior a su martes —, con la fecha de ese lunes.
// null si no hay fechas legibles o esa semana no está en el planning. Es la única
// forma de encontrar "la semana de la víspera": la usan la tarjeta del Cuadrante y
// el salto del editor (ordenar las semanas y coger la anterior fallaba si faltaba
// alguna semana entre medias).
export function semanaDeLaVispera(semanas = {}, semana, hoy = new Date()) {
  const rango = getWeekRange(semana, hoy);
  if (!rango) return null;
  const fecha = new Date(rango.start.getFullYear(), rango.start.getMonth(), rango.start.getDate() - 1);
  const entrada = Object.entries(semanas || {}).find(([, w]) => {
    if (!w || w === semana || esBorradorSemana(w)) return false;
    const r = getWeekRange(w, hoy);
    const lunes = r && resolveTaskDate(r, 'lunes');
    return lunes && mismoDia(lunes, fecha);
  });
  return entrada ? { clave: entrada[0], semana: entrada[1], fecha } : null;
}

// { fecha, semana, tareas: [{ task, idx }] } o null. Son TODAS las tareas del lunes de la
// semana anterior (semana NO borrador): las que tienen "Día Específico" Lunes y las que
// no lo tienen (sin él cuentan como lunes, ver resolveTaskEvalDay), ordenadas por hora.
export function tareasDeLaVispera(semanas = {}, semana, hoy = new Date()) {
  const encontrada = semanaDeLaVispera(semanas, semana, hoy);
  if (!encontrada) return null;
  const { semana: previa, fecha } = encontrada;
  const tareas = (previa.sundayMonday?.tasks || [])
    .map((task, idx) => ({ task, idx }))
    .filter(({ task }) => task && typeof task === 'object' && task.active !== false && resolveTaskEvalDay('domingo', task) === 'lunes')
    .sort((a, b) => inicioHora(a.task) - inicioHora(b.task));
  return tareas.length ? { fecha, semana: previa, tareas } : null;
}

// Quién fichó ese día y cuántas horas: [{ nombre, horas }], de más a menos. Cuentan los
// turnos que EMPIEZAN ese día (igual que el Resumen Financiero). `turnos` son los de
// pairShiftsFromEntries.
export function fichadosDelDia(turnos = [], fecha) {
  const porPersona = new Map();
  turnos.forEach(t => {
    const inicio = new Date(t.startEntry?.timestamp);
    if (isNaN(inicio) || !mismoDia(inicio, fecha)) return;
    porPersona.set(t.workerName, (porPersona.get(t.workerName) || 0) + (t.durationHours || 0));
  });
  return [...porPersona].map(([nombre, horas]) => ({ nombre, horas })).sort((a, b) => b.horas - a.horas);
}
