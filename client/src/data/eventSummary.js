import { splitEventNames, getEventShares } from './eventNaming';
import { personaDelFichaje } from './nombresTrabajadores';

// Desglose de costes por evento a partir de los turnos ya emparejados
// (subTasks de pairShiftsFromEntries). Si una tarea es de VARIOS eventos
// ("Boda A + Boda B - Recoger material"), sus horas y su coste se reparten
// entre ellos en proporción a sus pax (`paxByEvent`, ver buildPaxRegistry) o,
// si a alguno le falta, a partes iguales: los totales no cambian, solo dónde
// se anotan. `resolveEvent(taskName)` (buildTaskEventResolver) devuelve el evento
// anotado en el planning para ese fichaje, si lo hay.
// Devuelve [{ eventName, pax, totalCost, totalHours, horasEstimadas, workers: { [nombre]: {name, avatar, cost, hours} } }]
// ordenado por coste descendente.
// A qué evento(s) va un trozo de un turno → { eventNames, paxLocal }. El evento anotado en
// el planning manda sobre el deducido del texto; un trozo repartido por el planning
// (repartoPorPlanning.js) ya trae su evento.
export function eventosDelTrozo(subTask, resolveEvent = null) {
  const ctx = subTask.eventoPlanificado
    ? { event: subTask.eventoPlanificado, pax: subTask.paxPlanificado }
    : (resolveEvent ? resolveEvent(subTask.taskName) : null);
  const planned = typeof ctx === 'string' ? ctx : ctx?.event;
  const names = splitEventNames(planned || subTask.eventName || 'Sin Asignar / Extra');
  return { eventNames: names.length > 0 ? names : ['Sin Asignar / Extra'], paxLocal: ctx && typeof ctx === 'object' ? ctx.pax : null };
}

export function summarizeByEvent(shifts = [], workersList = [], paxByEvent = {}, resolveEvent = null) {
  const acc = {};

  shifts.forEach(shift => {
    (shift.subTasks || []).forEach(subTask => {
      const { eventNames, paxLocal } = eventosDelTrozo(subTask, resolveEvent); // pax de la semana de la tarea
      const shares = getEventShares(eventNames, paxLocal || paxByEvent);

      eventNames.forEach((eventName, i) => {
        const cost = (subTask.cost || 0) * shares[i];
        const hours = (subTask.durationHours || 0) * shares[i];
        const key = eventName.toLowerCase(); // sin distinguir mayúsculas
        if (!acc[key]) acc[key] = { eventName, pax: paxByEvent[key] || null, totalCost: 0, totalHours: 0, horasEstimadas: 0, workers: {} };
        acc[key].totalCost += cost;
        acc[key].totalHours += hours;
        if (subTask.estimado) acc[key].horasEstimadas += hours;

        const workerName = shift.workerName || 'Desconocido';
        if (!acc[key].workers[workerName]) {
          const roster = personaDelFichaje(workersList, workerName, w => w?.name); // no «lo contiene»: Ana no es Mariana
          acc[key].workers[workerName] = { name: workerName, avatar: roster?.avatar || '👤', cost: 0, hours: 0 };
        }
        acc[key].workers[workerName].cost += cost;
        acc[key].workers[workerName].hours += hours;
      });
    });
  });

  return Object.values(acc).sort((a, b) => b.totalCost - a.totalCost);
}
