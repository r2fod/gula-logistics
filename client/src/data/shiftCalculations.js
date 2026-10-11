// Un turno abierto (fichada entrada, sin salida todavía) que lleva más de
// esto sin cerrarse casi seguro que es porque el trabajador se olvidó de
// fichar salida (frecuente acabando de madrugada en una boda), no un turno
// real en curso. No se cierra solo — eso lo decide un admin a propósito
// desde el editor de fichajes — esto solo sirve para SEÑALARLO en vez de
// dejarlo indefinidamente como "en turno" con un cronómetro absurdo.
import { parseEventAndTask } from './eventNaming';
import { fechaDeFichaje, horaDeFichaje } from './fichajes';
import { mismoNombre, personaDelFichaje } from './nombresTrabajadores';

export const ZOMBIE_SHIFT_HOURS = 16;

// Turno largo: se paga entero (hay jornadas así de verdad), pero el admin recibe un
// aviso para revisarlo por si fue un olvido de fichar la salida (revisionFichajes.js).
// Antes se cortaba aquí sin avisar y esas horas se perdían.
export const HORAS_TURNO_LARGO = 14;
// Un turno AÚN ABIERTO avisa antes: si es un olvido de fichar la salida, cuanto antes
// se corrija, mejor (y si sigue trabajando, «Está bien» lo calla).
export const HORAS_ABIERTO_AVISO = 12;

// `activeEntry` es el fichaje de entrada abierto (lo que devuelve
// getActiveShiftForWorker, o activeShifts[worker] de pairShiftsFromEntries).
export function isZombieShift(activeEntry, now = new Date()) {
  if (!activeEntry?.timestamp) return false;
  const elapsedHours = (now - new Date(activeEntry.timestamp)) / (1000 * 60 * 60);
  return elapsedHours > ZOMBIE_SHIFT_HOURS;
}

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
  const { activeShifts } = pairShiftsFromEntries(entries);
  
  // Buscar usando case-insensitive para que coincida robustamente
  const lowerName = workerName.toLowerCase();
  for (const [wName, activeShift] of Object.entries(activeShifts)) {
    if (wName.toLowerCase() === lowerName) {
      return activeShift;
    }
  }
  return null;
}

// Empareja fichajes de entrada/salida en turnos con duración y coste —
// misma lógica que antes vivía duplicada en PartnerDashboardView.jsx
// (agregación por trabajador) y PayrollReportModal.jsx (lista de turnos).
// Quien está en nómina fija se valora a 14 €/h por defecto; el resto, 10 €/h de extra,
// salvo que el propio fichaje traiga su propia `rate`. Devuelve también
// `activeShifts` (entradas sin salida emparejada aún) para saber quién
// sigue fichado en este momento.
export function pairShiftsFromEntries(entries = []) {
  const shifts = [];
  const activeWorkerShifts = {};

  sortEntriesByTimestamp(entries).forEach(entry => {
    const { workerName, type, timestamp, isPayroll, rate, note, taskName } = entry;
    if (!workerName) return;

    // La misma persona ignorando mayúsculas y acentos (nunca "lo contiene": la salida
    // de "Mariana" cerraba el turno abierto de "Ana").
    const matchedKey = Object.keys(activeWorkerShifts).find(k => mismoNombre(k, workerName));
    const activeKey = matchedKey || workerName;

    if (type === 'entrada') {
      activeWorkerShifts[activeKey] = {
        startEntry: entry,
        tasks: [],
        lastTime: new Date(timestamp).getTime()
      };
    } else if (type === 'fichaje' && activeWorkerShifts[activeKey]) {
      // Subtask completed in V2
      const active = activeWorkerShifts[activeKey];
      const currentTime = new Date(timestamp).getTime();
      const diffMs = currentTime - active.lastTime;
      const durationHours = diffMs / (1000 * 60 * 60);

      active.tasks.push({
        taskName: taskName,
        durationHours,
        note
      });
      active.lastTime = currentTime;
      
    } else if (type === 'salida' && activeWorkerShifts[activeKey]) {
      const active = activeWorkerShifts[activeKey];
      const startEntry = active.startEntry;
      delete activeWorkerShifts[activeKey];

      const startDate = new Date(startEntry.timestamp);
      const endDate = new Date(timestamp);
      const totalDiffMs = endDate - startDate;
      const rawDuration = Math.max(0, totalDiffMs / (1000 * 60 * 60));
      const isAnomalous = rawDuration > HORAS_TURNO_LARGO;

      // Se paga a la media hora más cercana (para cerrar en billetes de 5€
      // o 10€ a la tarifa base, no en céntimos): *2 desplaza cada media
      // hora a un entero, se redondea al entero más cercano y /2 vuelve a
      // la escala de horas. 2h31m está más cerca de 2.5h que de 3h -> 2.5h;
      // 2h45m está justo en el punto medio entre 2.5h y 3h -> sube a 3h.
      const durationHours = Math.round(rawDuration * 2) / 2;
      const hours = Math.floor(durationHours);
      const minutes = Math.floor((durationHours - hours) * 60);

      // Antes había un fallback con dos nombres concretos escritos en el código —
      // con el || eso forzaba isSalaried=true para ellos SIEMPRE, aunque
      // su isPayroll real dijera lo contrario (si mañana alguno deja de
      // estar en nómina fija, el dato ya no manda). Confirmado que todos
      // sus fichajes reales ya traen isPayroll:true, así que quitarlo no
      // cambia nada hoy — solo evita que el código, no el dato, decida.
      const isSalaried = !!isPayroll;
      const hourlyRate = rate || (isSalaried ? 14 : 10);
      const cost = durationHours * hourlyRate;

      // Finalize subtasks for V2
      const finalTasks = [];
      if (startEntry.taskName === 'JORNADA') {
        // V2 Shift
        active.tasks.forEach(t => {
          // Cada tramo, en proporción a lo que duró dentro del turno ya redondeado.
          const ratio = rawDuration > 0 ? (t.durationHours / (totalDiffMs / (1000 * 60 * 60))) : 0;
          const adjustedDuration = durationHours * ratio;
          
          // Evento y tarea del texto del fichaje (ver eventNaming.js).
          const { eventName, specificTaskName } = parseEventAndTask(t.taskName || 'Sin Asignar');
          
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
        const { eventName, specificTaskName } = parseEventAndTask(startEntry.taskName || 'Sin Asignar');

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
        startDate: fechaDeFichaje(startEntry),
        startTime: horaDeFichaje(startEntry),
        endDate: fechaDeFichaje(entry),
        endTime: horaDeFichaje(entry),
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
    let currentTaskName = active.startEntry.taskName;
    if (active.tasks && active.tasks.length > 0) {
      currentTaskName = active.tasks[active.tasks.length - 1].taskName;
    }
    
    activeShiftsOut[wName] = {
      ...active.startEntry,
      taskName: currentTaskName
    };
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
    // Su persona del equipo: la misma (sin mayúsculas ni acentos) o su nombre seguido de
    // más; no "lo contiene" (las horas de "Mariana", ya fuera del equipo, iban a "Ana").
    let matchedKey = personaDelFichaje(Object.keys(workerBalances), shift.workerName);
    let bucket = matchedKey ? workerBalances[matchedKey] : null;

    if (!bucket) {
      // Alguien que ya no está en el roster actual (quitado, o un fichaje
      // con el nombre mal escrito) pero tiene fichajes reales — antes esto
      // se descartaba en silencio y sus horas/coste desaparecían de golpe
      // de Resumen Financiero y Saldos & Acuerdos en cuanto se le quitaba
      // del equipo. Se crea un bucket con los datos que trae el propio
      // fichaje (tarifa, si es nómina) para no perder ese histórico.
      bucket = {
        name: shift.workerName,
        role: 'Ya no está en el equipo',
        avatar: '❔',
        isPayroll: shift.isSalaried,
        rate: shift.rate,
        totalHours: 0,
        totalCost: 0,
        completedShifts: 0,
        shifts: [],
        isOrphaned: true
      };
      workerBalances[shift.workerName] = bucket;
    }
    bucket.totalHours += shift.durationHours;
    bucket.totalCost += shift.cost;
    
    // Group by Date for Jornada Partida (Split Shifts)
    const existingDay = bucket.shifts.find(s => s.startDate === shift.startDate);
    if (existingDay) {
      existingDay.durationHours += shift.durationHours;
      existingDay.cost += shift.cost;
      existingDay.endTime = shift.endTime; // Update end time to the latest one
      existingDay.ranges.push(`${shift.startTime} a ${shift.endTime}`);
      if (shift.subTasks) {
        existingDay.subTasks = existingDay.subTasks ? [...existingDay.subTasks, ...shift.subTasks] : [...shift.subTasks];
      }
      existingDay.entryIds = existingDay.entryIds || [existingDay.startEntry?.id, existingDay.endEntry?.id].filter(Boolean);
      if (shift.startEntry?.id) existingDay.entryIds.push(shift.startEntry.id);
      if (shift.endEntry?.id) existingDay.entryIds.push(shift.endEntry.id);
    } else {
      bucket.completedShifts += 1;
      bucket.shifts.push({
        ...shift,
        entryIds: [shift.startEntry?.id, shift.endEntry?.id].filter(Boolean),
        ranges: [`${shift.startTime} a ${shift.endTime}`]
      });
    }
  });

  return workerBalances;
}
