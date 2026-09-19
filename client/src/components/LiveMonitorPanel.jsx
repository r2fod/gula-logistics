import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  Clock, 
  MapPin, 
  Truck, 
  Package, 
  Broom, 
  ShieldCheck, 
  UserCheck,
  Play,
  Square,
  Radio,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { pairShiftsFromEntries } from '../data/shiftCalculations';
import { getTaskListForDay, isTaskChronologicallyPast } from '../data/taskPlanning';

export default function LiveMonitorPanel({
  workersList = [],
  clockEntries = [],
  activeWeekData = {},
  onClockEntryCreated,
  onOpenClockModal
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'trucks' | 'base'

  // Live timer for elapsed shift duration
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Map active clock entries per worker. Memoizado por `clockEntries`: el
  // timer de arriba fuerza un re-render cada segundo (currentTime), y sin
  // esto se reordenaban y emparejaban TODOS los fichajes 60 veces por
  // minuto aunque no hubiera ni un fichaje nuevo.
  const { activeShifts } = useMemo(() => pairShiftsFromEntries(clockEntries), [clockEntries]);

  const parseTimeToMinutes = (str) => {
    const m = /(\d{1,2}):(\d{2})/.exec(str || '');
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const getAssignedTasksForWorker = (workerName) => {
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const todayIndex = currentTime.getDay();
    const dayKey = days[todayIndex];

    const tasks = getTaskListForDay(activeWeekData, dayKey);

    const nameLower = workerName.toLowerCase();
    return tasks.filter(t => {
      if (typeof t === 'object' && Array.isArray(t.assigned) && t.assigned.length > 0) {
        return t.assigned.some(a => a.toLowerCase() === nameLower);
      }
      const text = typeof t === 'object' ? t.text : t;
      return text.toLowerCase().includes(nameLower);
    });
  };

  const DEFAULT_TASK_BY_WORKER = {
    'Gonzalo': '🚚 Ruta Flota / Albacar & Fincas',
    'Ricardo': '🚚 Ruta Flota / Albacar & Fincas',
    'Johan': '🚚 Descarga Fincas / Backup Camión 2',
    'Irene': '📦 Almacén Base / Checklist Pedidos & Frío',
    'Jeferson': '📦 Pre-carga Almacén & Soporte Logística',
    'Kerly': '🧹 Higienización & Vajilla Eventos',
    'Jose': '🧹 Higienización & Vajilla Eventos',
    'Raúl': '📋 Supervisión Flota & Estiba Camiones'
  };

  const getWorkerTaskInfo = (workerName) => {
    const allMatches = getAssignedTasksForWorker(workerName);

    if (allMatches.length === 0) {
      return { text: DEFAULT_TASK_BY_WORKER[workerName] || '📋 Asignado en Operativa Activa', extraCount: 0 };
    }

    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const dayKey = days[currentTime.getDay()];

    const matches = allMatches.filter(t => {
      if (typeof t !== 'object') return true; // Simple strings are assumed incomplete unless mapped to obj
      if (t.completed) return false; // Explicitly marked as done
      if (isTaskChronologicallyPast(dayKey, t.timeFrame, currentTime)) return false; // Chronologically done
      return true;
    });

    if (matches.length === 0) {
      return { text: '✅ Todas las tareas de hoy completadas', extraCount: 0 };
    }

    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    // De las tareas del día, prioriza la que está ocurriendo AHORA según su
    // horario; si ninguna encaja, la próxima por empezar; si no hay ninguna
    // con horario, la primera de la lista.
    const withRange = matches
      .map(t => {
        if (typeof t !== 'object' || !t.timeFrame) return null;
        const [startStr, endStr] = t.timeFrame.split('-');
        const start = parseTimeToMinutes(startStr);
        const end = endStr ? parseTimeToMinutes(endStr) : null;
        return start === null ? null : { task: t, start, end };
      })
      .filter(Boolean);

    // Rangos que cruzan medianoche (ej. "22:00 - 00:00" en tareas nocturnas
    // de boda) tienen end < start — sin este caso aparte, la comparación de
    // rango simple nunca los marca como "en curso" durante la propia noche.
    const isWithinRange = (start, end) => {
      if (end === null) return nowMinutes >= start;
      return end < start ? (nowMinutes >= start || nowMinutes <= end) : (nowMinutes >= start && nowMinutes <= end);
    };
    const current = withRange.find(({ start, end }) => isWithinRange(start, end));
    const upcoming = !current && withRange.filter(({ start }) => start >= nowMinutes).sort((a, b) => a.start - b.start)[0];
    const primary = current?.task || upcoming?.task || matches[0];

    return {
      text: typeof primary === 'object' ? primary.text : primary,
      extraCount: Math.max(0, matches.length - 1)
    };
  };

  const getWorkerLocation = (workerName) => {
    if (workerName === 'Gonzalo' || workerName === 'Ricardo' || workerName === 'Johan') {
      return '📍 En Ruta / Fincas Eventos';
    }
    if (workerName === 'Kerly' || workerName === 'Jose') {
      return '📍 Almacén Base / Limpieza';
    }
    return '📍 Almacén Base (Gula Ops)';
  };

  const workerStatuses = workersList.map(w => {
    const clockEntry = activeShifts[w.name];
    const isClockedIn = !!clockEntry;

    let elapsedTimeFormatted = '0h 00m';
    let elapsedMs = 0;

    if (isClockedIn) {
      const startTime = new Date(clockEntry.timestamp);
      elapsedMs = Math.max(0, currentTime - startTime);
      const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
      const minutes = Math.floor((elapsedMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((elapsedMs % (1000 * 60)) / 1000);
      elapsedTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
    }

    // Prefer the task the worker actually clocked into (fichar por tarea)
    // over the day-of-week guess, so this reflects real, live control.
    const rawTaskName = clockEntry?.taskName || clockEntry?.note;
    const taskInfo = getWorkerTaskInfo(w.name);
    
    // If the task name is a generic clock-in label like "JORNADA" or "Inicio de Jornada Operativa",
    // intelligently fall back to the assigned task from the schedule instead of showing the generic text.
    const isGenericTaskName = rawTaskName && (
      rawTaskName.toUpperCase() === 'JORNADA' || 
      rawTaskName.toUpperCase().includes('INICIO DE JORNADA')
    );
    
    const currentTaskToDisplay = (rawTaskName && !isGenericTaskName) ? rawTaskName : taskInfo.text;

    return {
      ...w,
      isClockedIn,
      clockEntry,
      elapsedTimeFormatted,
      currentTask: currentTaskToDisplay,
      extraTasksCount: (rawTaskName && !isGenericTaskName) ? 0 : taskInfo.extraCount,
      location: getWorkerLocation(w.name)
    };
  });

  const activeCount = workerStatuses.filter(w => w.isClockedIn).length;
  const teamActivePercent = workersList.length > 0 ? Math.round((activeCount / workersList.length) * 100) : 0;

  const filteredWorkers = workerStatuses.filter(w => {
    if (filterStatus === 'active') return w.isClockedIn;
    if (filterStatus === 'trucks') return w.role.toLowerCase().includes('conductor') || w.role.toLowerCase().includes('flota');
    if (filterStatus === 'base') return !w.role.toLowerCase().includes('conductor') && !w.role.toLowerCase().includes('flota');
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Live Monitor Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-3.5 sm:space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
          
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping"></span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-2xl font-extrabold font-['Outfit'] text-white truncate">
                  Monitor de Actividad en Tiempo Real
                </h3>
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>EN VIVO</span>
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate">
                Seguimiento en directo de estado de jornada y avance por trabajador.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center md:space-x-3">
            <div className="bg-slate-950/80 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl border border-slate-800 text-center">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Fichados Ahora</span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-400 font-['Outfit']">
                {activeCount} / {workersList.length}
              </span>
            </div>

            <div className="bg-slate-950/80 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl border border-slate-800 text-center font-mono">
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Hora Oficial</span>
              <span className="text-xs sm:text-sm font-bold text-amber-400">
                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </span>
            </div>
          </div>
        </div>

        {/* Global Operational Progress Bar */}
        <div className="bg-slate-950 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-300 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cobertura de Jornada del Equipo</span>
            </span>
            <span className="text-emerald-400 font-mono text-xs sm:text-sm">{teamActivePercent}% Activo</span>
          </div>

          <div className="w-full h-2.5 sm:h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.max(5, teamActivePercent)}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold">
            <span>{activeCount} Trabajadores en Turno</span>
            <span>{workersList.length - activeCount} en Espera / Descanso</span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-2 pt-2 border-t border-slate-800/80 overflow-x-auto no-scrollbar w-full max-w-full">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              filterStatus === 'all' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Todos ({workersList.length})
          </button>

          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              filterStatus === 'active' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            En Turno ({activeCount})
          </button>

          <button
            onClick={() => setFilterStatus('trucks')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              filterStatus === 'trucks' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🚚 Conductores Flota
          </button>

          <button
            onClick={() => setFilterStatus('base')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
              filterStatus === 'base' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            📦 Base & Preparación
          </button>
        </div>
      </div>

      {/* Workers Real-Time Live Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">
        {filteredWorkers.map((worker) => {
          // Calculate progress percentage of standard 8h shift
          const targetShiftHours = 8;
          let shiftHours = 0;
          if (worker.isClockedIn && worker.clockEntry) {
            const startTime = new Date(worker.clockEntry.timestamp);
            shiftHours = Math.max(0, (currentTime - startTime) / (1000 * 60 * 60));
          }
          const shiftProgressPercent = Math.min(100, Math.round((shiftHours / targetShiftHours) * 100));

          return (
            <div 
              key={worker.name}
              className={`relative overflow-hidden rounded-3xl p-5 border transition-all duration-300 shadow-lg flex flex-col justify-between space-y-4 ${
                worker.isClockedIn 
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-emerald-500/10 ring-1 ring-emerald-500/30' 
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Active glowing accent strip */}
              {worker.isClockedIn && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400 animate-pulse"></div>
              )}

              <div>
                {/* Header Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      {worker.avatar}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-white text-base font-['Outfit']">{worker.name}</h4>
                      <p className="text-[11px] text-slate-400 leading-snug">{worker.role}</p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {worker.isClockedIn ? (
                    <span className="px-2.5 py-1 text-[10px] font-extrabold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      <span>EN TURNO</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      ⚪ DESCANSO
                    </span>
                  )}
                </div>

                {/* Individual Worker Shift Progress Bar */}
                <div className="mt-4 p-3 rounded-2xl bg-slate-950/90 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Avance de Jornada:</span>
                    </span>
                    <span className="font-mono font-extrabold text-emerald-400">
                      {worker.isClockedIn ? `${shiftProgressPercent}%` : '0%'}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        worker.isClockedIn 
                          ? 'bg-gradient-to-r from-emerald-500 to-amber-400' 
                          : 'bg-slate-800'
                      }`}
                      style={{ width: `${worker.isClockedIn ? Math.max(8, shiftProgressPercent) : 0}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                    <span>{worker.isClockedIn ? worker.elapsedTimeFormatted : '0h 00m'}</span>
                    <span>Objetivo ~8h</span>
                  </div>
                </div>

                {/* Current Task Box */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Actividad / Tarea Asignada
                    </span>
                    {worker.extraTasksCount > 0 && (
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-md shrink-0">
                        +{worker.extraTasksCount} más hoy
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-medium">
                    {worker.currentTask}
                  </div>
                </div>
              </div>

              {/* Location Badge */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center space-x-1 text-slate-300 font-medium min-w-0 flex-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{worker.location}</span>
                </span>

                {worker.isPayroll ? (
                  <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 shrink-0">
                    Nómina (14€/h)
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                    Extra (10€/h)
                  </span>
                )}
              </div>

              {/* Direct Task Action Control Button */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    if (worker.isClockedIn) {
                      const now = new Date();
                      const entry = {
                        id: Date.now().toString(),
                        workerName: worker.name,
                        role: worker.role,
                        isPayroll: worker.isPayroll,
                        rate: worker.rate || 10,
                        type: 'salida',
                        timestamp: now.toISOString(),
                        // Locale y hour12 fijos: mismo criterio que ClockInModal/AdminClockEditModal.
                        timeFormatted: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        dateFormatted: now.toLocaleDateString('es-ES'),
                        note: `Finalizada tarea: ${worker.currentTask}`
                      };
                      if (onClockEntryCreated) onClockEntryCreated(entry);
                    } else {
                      if (onOpenClockModal) onOpenClockModal(worker.name);
                    }
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 ${
                    worker.isClockedIn
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  }`}
                >
                  {worker.isClockedIn ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>⏹️ Finalizar Tarea Activa</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>▶️ Iniciar Nueva Tarea</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
