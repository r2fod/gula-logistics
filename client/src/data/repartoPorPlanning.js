import { getTaskInterval, getWeekRange } from './taskPlanning';
import { parseEventAndTask, EVENT_CATEGORIES, GENERAL_EVENT, paxDeSemana, esBorradorSemana } from './eventNaming';

// Reparto del tiempo de jornada SIN TAREA entre los eventos del planning.
//
// Quien ficha "Inicio de Jornada" (o entra y sale sin fichar tareas) deja horas
// reales sin evento: en el desglose de costes caían todas en "Tareas Internas".
// Aquí se reparten entre las tareas del planning en las que esa persona estaba
// asignada, sin tocar ni un fichaje: el total de horas y de dinero de cada turno
// es el mismo, solo cambia dónde se anota.
//
//   1) Se reparte entre las tareas asignadas a esa persona cuyo horario real se
//      solapa con el turno, en proporción a los minutos de solape.
//   2) Si ninguna se solapa, entre las tareas suyas de ese mismo día, en
//      proporción a lo que dura cada una.
//   3) Si tampoco hay, entre las tareas suyas de esa semana (la jornada de un día
//      sin nada planificado: p. ej. limpieza el domingo tras las bodas), en
//      proporción a lo que dura cada una.
//   4) Si no tiene ninguna esa semana, se queda en "Tareas Internas" (no se
//      inventa un evento).
//
// Cada trozo lleva `estimado: true` para poder avisar en pantalla de que ese
// reparto sale del planning y no de un fichaje.

const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MINUTO = 60 * 1000;
const mismoDia = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Un texto sin pistas es "su propio evento" (así lo trata el desglose), pero
// para repartir solo sirven eventos de verdad: los de la tarea, "Boda X",
// "Evento X" o las categorías generales.
function eventoDeTarea(texto, eventoAnotado) {
  const parsed = parseEventAndTask(texto);
  if (parsed.explicit) return parsed.eventName;
  if (eventoAnotado) return eventoAnotado;
  if (EVENT_CATEGORIES.includes(parsed.eventName) || /^(boda|evento)\s/i.test(parsed.eventName)) return parsed.eventName;
  return null;
}

// Todas las tareas de las semanas NO borrador con su tramo real, su evento y
// las personas asignadas y los límites de su semana (la cola del lunes incluida):
// [{ evento, pax, asignados, inicio, fin, texto, semanaDesde, semanaHasta }].
export function listarTareasPlanificadas(weeksMap = {}, now = new Date()) {
  const tareas = [];
  Object.values(weeksMap || {}).filter(w => w && !esBorradorSemana(w)).forEach(week => {
    const pax = paxDeSemana(week);
    const rango = getWeekRange(week, now);
    if (!rango) return; // sin fechas legibles no se puede saber cuándo pasó nada
    const semanaDesde = rango.start;
    const semanaHasta = new Date(rango.end.getFullYear(), rango.end.getMonth(), rango.end.getDate() + 2); // hasta el lunes de cola inclusive
    const anadir = (dayKey, task, texto, evento) => {
      if (!task || typeof task !== 'object' || !Array.isArray(task.assigned) || !evento) return;
      const tramo = getTaskInterval(week, dayKey, task, now);
      if (!tramo) return;
      tareas.push({ evento, pax, asignados: task.assigned.map(plain), inicio: tramo.start, fin: tramo.end, texto, semanaDesde, semanaHasta });
    };
    Object.entries(week.schedule || {}).forEach(([dayKey, day]) => {
      (day?.tasks || []).forEach(t => t?.text && anadir(dayKey, t, t.text, eventoDeTarea(t.text, t.event)));
    });
    (week.sundayMonday?.tasks || []).forEach(t => t?.text && anadir('domingo', t, t.text, eventoDeTarea(t.text, t.event)));
    (week.saturdaySpecial?.weddings || []).forEach(w => {
      const texto = `Boda: ${w?.location} (${w?.truck})`;
      anadir('sabado', w, texto, w?.event || eventoDeTarea(texto, null));
    });
  });
  return tareas;
}

// Devuelve los turnos con el tiempo sin tarea repartido. Los turnos que no lo
// necesitan (o no se pueden repartir) se devuelven tal cual, sin copiar.
// `resolveEvent` es buildTaskContextResolver: un fichaje que ya se enlaza con
// una tarea del planning no es "sin tarea".
export function repartirTiempoSinTarea(shifts = [], weeksMap = {}, resolveEvent = null, now = new Date()) {
  const esSinTarea = (st) => st.eventName === GENERAL_EVENT && !(resolveEvent && resolveEvent(st.taskName));
  if (!shifts.some(s => (s.subTasks || []).some(esSinTarea))) return shifts;

  const tareas = listarTareasPlanificadas(weeksMap, now);

  return shifts.map(shift => {
    if (!(shift.subTasks || []).some(esSinTarea)) return shift;
    const ini = new Date(shift.startEntry?.timestamp);
    const fin = new Date(shift.endEntry?.timestamp);
    if (isNaN(ini) || isNaN(fin) || fin <= ini) return shift;
    const persona = plain(shift.workerName);
    const suyas = tareas.filter(t => t.asignados.includes(persona));

    // Peso de cada tarea suya: minutos de solape con el turno; si no hay ninguna
    // que se solape, lo que dura cada una de ese día; y si tampoco, las de la semana.
    let pesos = suyas.map(t => Math.max(0, Math.min(fin, t.fin) - Math.max(ini, t.inicio)) / MINUTO);
    if (!pesos.some(p => p > 0)) {
      pesos = suyas.map(t => (mismoDia(t.inicio, ini) ? (t.fin - t.inicio) / MINUTO : 0));
    }
    if (!pesos.some(p => p > 0)) {
      pesos = suyas.map(t => (ini >= t.semanaDesde && ini < t.semanaHasta ? (t.fin - t.inicio) / MINUTO : 0));
    }
    const total = pesos.reduce((a, b) => a + b, 0);
    if (total <= 0) return shift;

    const subTasks = [];
    shift.subTasks.forEach(st => {
      if (!esSinTarea(st)) { subTasks.push(st); return; }
      suyas.forEach((t, i) => {
        if (pesos[i] <= 0) return;
        const parte = pesos[i] / total;
        subTasks.push({
          ...st,
          durationHours: st.durationHours * parte,
          cost: st.cost * parte,
          specificTaskName: `Tiempo sin tarea repartido según el planning (${t.texto})`,
          eventoPlanificado: t.evento,
          paxPlanificado: t.pax,
          estimado: true,
        });
      });
    });
    return { ...shift, subTasks };
  });
}
