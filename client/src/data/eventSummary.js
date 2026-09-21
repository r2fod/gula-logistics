import { splitEventNames } from './eventNaming';

// Desglose de costes por evento a partir de los turnos ya emparejados
// (subTasks de pairShiftsFromEntries). Si una tarea es de VARIOS eventos
// ("Boda A + Boda B - Recoger material"), sus horas y su coste se reparten a
// partes iguales entre ellos: los totales no cambian, solo dónde se anotan.
// Devuelve [{ eventName, totalCost, totalHours, workers: { [nombre]: {name, avatar, cost, hours} } }]
// ordenado por coste descendente.
export function summarizeByEvent(shifts = [], workersList = []) {
  const acc = {};

  shifts.forEach(shift => {
    (shift.subTasks || []).forEach(subTask => {
      const names = splitEventNames(subTask.eventName || 'Sin Asignar / Extra');
      const eventNames = names.length > 0 ? names : ['Sin Asignar / Extra'];
      const share = 1 / eventNames.length;
      const cost = (subTask.cost || 0) * share;
      const hours = (subTask.durationHours || 0) * share;

      eventNames.forEach(eventName => {
        const key = eventName.toLowerCase(); // sin distinguir mayúsculas
        if (!acc[key]) acc[key] = { eventName, totalCost: 0, totalHours: 0, workers: {} };
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
