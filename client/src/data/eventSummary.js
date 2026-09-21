import { splitEventNames, getEventShares } from './eventNaming';

// Desglose de costes por evento a partir de los turnos ya emparejados
// (subTasks de pairShiftsFromEntries). Si una tarea es de VARIOS eventos
// ("Boda A + Boda B - Recoger material"), sus horas y su coste se reparten
// entre ellos en proporción a sus pax (`paxByEvent`, ver buildPaxRegistry) o,
// si a alguno le falta, a partes iguales: los totales no cambian, solo dónde
// se anotan. `resolveEvent(taskName)` (buildTaskEventResolver) devuelve el evento
// anotado en el planning para ese fichaje, si lo hay.
// Devuelve [{ eventName, pax, totalCost, totalHours, workers: { [nombre]: {name, avatar, cost, hours} } }]
// ordenado por coste descendente.
export function summarizeByEvent(shifts = [], workersList = [], paxByEvent = {}, resolveEvent = null) {
  const acc = {};

  shifts.forEach(shift => {
    (shift.subTasks || []).forEach(subTask => {
      // El evento anotado en el planning manda sobre el deducido del texto.
      const ctx = resolveEvent ? resolveEvent(subTask.taskName) : null;
      const planned = typeof ctx === 'string' ? ctx : ctx?.event;
      const paxLocal = ctx && typeof ctx === 'object' ? ctx.pax : null; // pax de la semana de la tarea
      const names = splitEventNames(planned || subTask.eventName || 'Sin Asignar / Extra');
      const eventNames = names.length > 0 ? names : ['Sin Asignar / Extra'];
      const shares = getEventShares(eventNames, paxLocal || paxByEvent);

      eventNames.forEach((eventName, i) => {
        const cost = (subTask.cost || 0) * shares[i];
        const hours = (subTask.durationHours || 0) * shares[i];
        const key = eventName.toLowerCase(); // sin distinguir mayúsculas
        if (!acc[key]) acc[key] = { eventName, pax: paxByEvent[key] || null, totalCost: 0, totalHours: 0, workers: {} };
        acc[key].totalCost += cost;
        acc[key].totalHours += hours;

        const workerName = shift.workerName || 'Desconocido';
        if (!acc[key].workers[workerName]) {
          const roster = workersList.find(w => w.name?.toLowerCase().includes(workerName.toLowerCase() || ''));
          acc[key].workers[workerName] = { name: workerName, avatar: roster?.avatar || '👤', cost: 0, hours: 0 };
        }
        acc[key].workers[workerName].cost += cost;
        acc[key].workers[workerName].hours += hours;
      });
    });
  });

  return Object.values(acc).sort((a, b) => b.totalCost - a.totalCost);
}
