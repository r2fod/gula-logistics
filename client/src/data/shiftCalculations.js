// El servidor devuelve los fichajes más recientes primero (para que el
// historial se vea así en la UI), pero emparejar entrada/salida y saber
// "quién está fichado ahora" necesita procesarlos en orden cronológico —
// si no, un trabajador con más de un fichaje histórico queda con su
// PRIMERA entrada de siempre marcada como "la más reciente" (no desficha
// nunca). Usar siempre esta función antes de mirar el orden del array.
export function sortEntriesByTimestamp(entries = []) {
  return [...entries].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Devuelve el fichaje de entrada activo de un trabajador (o null si no está
// fichado ahora mismo), calculado en orden cronológico real.
export function getActiveShiftForWorker(entries = [], workerName) {
  if (!workerName) return null;
  const mine = entries.filter(e => e.workerName?.toLowerCase() === workerName.toLowerCase());
  const sorted = sortEntriesByTimestamp(mine);
  const lastEntry = sorted[sorted.length - 1];
  return (lastEntry && lastEntry.type === 'entrada') ? lastEntry : null;
}

// Empareja fichajes de entrada/salida en turnos con duración y coste —
// misma lógica que antes vivía duplicada en PartnerDashboardView.jsx
// (agregación por trabajador) y PayrollReportModal.jsx (lista de turnos).
// Los workers a 14€/h fijo son Irene y Raúl (Nómina), el resto 10€/h Extra,
// salvo que el propio fichaje traiga su propia `rate`. Devuelve también
// `activeShifts` (entradas sin salida emparejada aún) para saber quién
// sigue fichado en este momento.
export function pairShiftsFromEntries(entries = []) {
  const shifts = [];
  const activeWorkerShifts = {};

  sortEntriesByTimestamp(entries).forEach(entry => {
    const { workerName, type, timestamp, timeFormatted, dateFormatted, isPayroll, rate, note } = entry;

    if (type === 'entrada') {
      activeWorkerShifts[workerName] = entry;
    } else if (type === 'salida' && activeWorkerShifts[workerName]) {
      const startEntry = activeWorkerShifts[workerName];
      delete activeWorkerShifts[workerName];

      const startDate = new Date(startEntry.timestamp);
      const endDate = new Date(timestamp);
      const diffMs = endDate - startDate;
      const durationHours = Math.max(0, diffMs / (1000 * 60 * 60));

      const hours = Math.floor(durationHours);
      const minutes = Math.floor((durationHours - hours) * 60);

      const isSalaried = isPayroll || workerName === 'Irene' || workerName === 'Raúl';
      const hourlyRate = rate || (isSalaried ? 14 : 10);
      const cost = durationHours * hourlyRate;

      shifts.push({
        id: `${startEntry.id}-${entry.id}`,
        startEntry,
        endEntry: entry,
        workerName,
        isSalaried,
        rate: hourlyRate,
        startDate: startEntry.dateFormatted,
        startTime: startEntry.timeFormatted,
        endDate: dateFormatted,
        endTime: timeFormatted,
        durationHours,
        durationFormatted: `${hours}h ${minutes}m`,
        cost,
        note: startEntry.note || note
      });
    }
  });

  return { shifts, activeShifts: activeWorkerShifts };
}

// Agrega los turnos ya emparejados en totales por trabajador (horas, coste,
// nº de turnos completados) — lo que necesita el panel de saldos.
export function aggregateShiftsByWorker(shifts, workersList = []) {
  const workerBalances = {};

  workersList.forEach(w => {
    workerBalances[w.name] = {
      name: w.name,
      role: w.role,
      avatar: w.avatar,
      isPayroll: w.isPayroll,
      rate: w.rate || (w.isPayroll ? 14 : 10),
      totalHours: 0,
      totalCost: 0,
      completedShifts: 0
    };
  });

  shifts.forEach(shift => {
    const bucket = workerBalances[shift.workerName];
    if (!bucket) return;
    bucket.totalHours += shift.durationHours;
    bucket.totalCost += shift.cost;
    bucket.completedShifts += 1;
  });

  return workerBalances;
}
