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
    const { workerName, type, timestamp, timeFormatted, dateFormatted, isPayroll, rate, note, taskName } = entry;

    if (type === 'entrada') {
      activeWorkerShifts[workerName] = {
        startEntry: entry,
        tasks: [],
        lastTime: new Date(timestamp).getTime()
      };
    } else if (type === 'fichaje' && activeWorkerShifts[workerName]) {
      // Subtask completed in V2
      const active = activeWorkerShifts[workerName];
      const currentTime = new Date(timestamp).getTime();
      const diffMs = currentTime - active.lastTime;
      const durationHours = diffMs / (1000 * 60 * 60);

      active.tasks.push({
        taskName: taskName,
        durationHours,
        note
      });
      active.lastTime = currentTime;
      
    } else if (type === 'salida' && activeWorkerShifts[workerName]) {
      const active = activeWorkerShifts[workerName];
      const startEntry = active.startEntry;
      delete activeWorkerShifts[workerName];

      const startDate = new Date(startEntry.timestamp);
      const endDate = new Date(timestamp);
      const totalDiffMs = endDate - startDate;
      let rawDuration = Math.max(0, totalDiffMs / (1000 * 60 * 60));
      let isAnomalous = false;

      if (rawDuration > 14) {
        rawDuration = 14;
        isAnomalous = true;
      }

      const durationHours = Math.round(rawDuration * 100) / 100;
      const hours = Math.floor(durationHours);
      const minutes = Math.floor((durationHours - hours) * 60);

      const isSalaried = isPayroll || workerName === 'Irene' || workerName === 'Raúl';
      const hourlyRate = rate || (isSalaried ? 14 : 10);
      const cost = durationHours * hourlyRate;

      // Finalize subtasks for V2
      const finalTasks = [];
      if (startEntry.taskName === 'JORNADA') {
        // V2 Shift
        active.tasks.forEach(t => {
          // Normalize subtask duration so it doesn't exceed total (in case of anomalous cap)
          const ratio = rawDuration > 0 ? (t.durationHours / (totalDiffMs / (1000 * 60 * 60))) : 0;
          const adjustedDuration = durationHours * ratio;
          
          let eventName = t.taskName || 'Sin Asignar';
          let specificTaskName = 'Tarea General';
          
          if (eventName.includes(' - ')) {
            const parts = eventName.split(' - ');
            eventName = parts[0].trim();
            specificTaskName = parts.slice(1).join(' - ').trim();
          }
          
          finalTasks.push({
            taskName: t.taskName,
            eventName: eventName,
            specificTaskName: specificTaskName,
            durationHours: adjustedDuration,
            cost: adjustedDuration * hourlyRate,
            note: t.note
          });
        });
        
        // Any remaining time goes to "Sin Asignar"
        const assignedHours = finalTasks.reduce((acc, t) => acc + t.durationHours, 0);
        const remainingHours = Math.max(0, durationHours - assignedHours);
        if (remainingHours > 0.01) {
          finalTasks.push({
            taskName: 'Sin Asignar / General',
            eventName: 'Tareas Internas',
            specificTaskName: 'Tiempo no asignado',
            durationHours: remainingHours,
            cost: remainingHours * hourlyRate,
            note: 'Tiempo de jornada no asignado a tareas específicas'
          });
        }
      } else {
        // V1 Shift
        let eventName = startEntry.taskName || 'Sin Asignar';
        let specificTaskName = 'Tarea General';
        
        if (eventName.includes(' - ')) {
          const parts = eventName.split(' - ');
          eventName = parts[0].trim();
          specificTaskName = parts.slice(1).join(' - ').trim();
        }

        finalTasks.push({
          taskName: startEntry.taskName || 'Sin Asignar',
          eventName: eventName,
          specificTaskName: specificTaskName,
          durationHours,
          cost,
          note: startEntry.note || note
        });
      }

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
        isAnomalous,
        note: startEntry.note || note,
        subTasks: finalTasks // For the events summary
      });
    }
  });

  // Return active shifts (just map the active object back to its startEntry for UI compatibility)
  const activeShiftsOut = {};
  for (const [wName, active] of Object.entries(activeWorkerShifts)) {
    activeShiftsOut[wName] = active.startEntry;
  }

  return { shifts, activeShifts: activeShiftsOut };
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
      completedShifts: 0,
      shifts: []
    };
  });

  shifts.forEach(shift => {
    const bucket = workerBalances[shift.workerName];
    if (!bucket) return;
    bucket.totalHours += shift.durationHours;
    bucket.totalCost += shift.cost;
    bucket.completedShifts += 1;
    bucket.shifts.push(shift);
  });

  return workerBalances;
}
