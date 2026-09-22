import React, { useState, useEffect, useMemo } from 'react';
import { Award, BarChart3, Bell, Calendar, Car, CheckCircle2, CheckSquare, Clock, ListTodo, Lock, MapPin, Pin, Play, Plus, Settings, Square, Target, Users, Zap } from 'lucide-react';
import ClockInModal from './ClockInModal';
import TaskFlowGraphView from './TaskFlowGraphView';
import AdminClockEditModal from './AdminClockEditModal';
import WorkerViewTaskItem from './dashboard/WorkerViewTaskItem';
import WorkerViewWeddingCard from './dashboard/WorkerViewWeddingCard';
import { getActiveShiftForWorker, pairShiftsFromEntries } from '../data/shiftCalculations';
import TaskTextWithEvent from './TaskTextWithEvent';
import { getTaskListForDay, resolveTaskIndexByText, isTaskEffectivelyDone, isTaskAssignedTo, getDayLabel, getWeddingsBadge, getWeekRange, resolveTaskDate, getNextTaskStart, isTaskTooEarlyToStart } from '../data/taskPlanning';
import { subscribeToPush } from '../data/pushService';
import { crearFichaje, horaDeFichaje, fechaDeFichaje } from '../data/fichajes';
import { getWeddingTaskName } from '../data/eventNaming';
import { formatTimeShort, formatWeekdayDay } from '../utils/dateUtils';
import { formatearHoras } from '../data/formatoFinanciero';
import EstadoVacio from './ui/EstadoVacio';


// Texto del botón de empezar la jornada: se elige uno al azar al abrir la
// vista (no en cada render, para que no cambie cada segundo). Todas dicen
// claramente lo que hace el botón.
const START_JORNADA_LABELS = [
  'INICIAR JORNADA AHORA',
  '¡ARRANCAMOS! INICIAR JORNADA',
  '¡A POR EL DÍA! INICIAR JORNADA',
  '¡VAMOS ALLÁ! INICIAR JORNADA',
  'CAFÉ TOMADO: INICIAR JORNADA',
  '¡A MOVER CAJAS! INICIAR JORNADA',
  '¡A LA CARRETERA! INICIAR JORNADA',
  '¡CON GANAS! INICIAR JORNADA',
];

// Aviso gris con candado: la acción todavía no se puede hacer (el día no ha llegado o aún
// falta para la hora de la tarea). `className` pone su posición y `flex` si va suelto.
function AvisoBloqueado({ className = '', children }) {
  return (
    <span className={`${className || 'inline-flex'} items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-slate-800/60 text-slate-500 border border-slate-700 cursor-not-allowed`}>
      <Lock className="w-3 h-3" />
      <span>{children}</span>
    </span>
  );
}

export default function WorkerView({
  workerName,
  workersList = [],
  activeWeekData = {},
  clockEntries = [],
  isAdmin = false,
  onToggleTask,
  onClockEntryCreated,
  onUpdateClockEntry,
  onDeleteClockEntry,
  onToggleGeneralView,
  onOpenAdminDashboard
}) {
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [prefilledTask, setPrefilledTask] = useState(null); // for task-level clock-in
  const [taskRef, setTaskRef] = useState(null); // { dayKey, taskIndex } — para marcar la tarea como hecha al fichar salida
  const [currentTime, setCurrentTime] = useState(new Date());
  const [startLabel] = useState(() => START_JORNADA_LABELS[Math.floor(Math.random() * START_JORNADA_LABELS.length)]);
  const [selectedDayKey, setSelectedDayKey] = useState('all');
  const [viewModeType, setViewModeType] = useState('calendar'); // 'calendar' | 'graph'
  const [workerTab, setWorkerTab] = useState('tasks'); // 'tasks' | 'history'
  // Solo para AÑADIR un fichaje manual olvidado (POST, sin admin) — nunca
  // para editar/borrar uno ya enviado: eso está bloqueado y solo puede
  // hacerlo Administración (el servidor lo exige en clock.routes.js).
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [pushStatus, setPushStatus] = useState(() => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    return 'idle';
  });

  const handleSubscribePush = async () => {
    try {
      setPushStatus('loading');
      await subscribeToPush(currentWorkerObj.name);
      setPushStatus('granted');
    } catch (err) {
      console.error(err);
      setPushStatus('error');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentWorkerObj = workersList.find(w => w.name.toLowerCase() === workerName.toLowerCase()) || {
    name: workerName,
    role: "Operativa Logística",
    avatar: "👤",
    truck: "Flota Gula",
    isPayroll: false,
    rate: 10
  };

  // Worker's own active shift. El servidor devuelve los fichajes más
  // recientes primero (para el historial), así que "el último del array"
  // NO es "el más reciente" — hay que mirar el orden cronológico real
  // (ver getActiveShiftForWorker), si no un trabajador con 2+ fichajes
  // históricos queda con su primera entrada de siempre marcada como activa
  // para siempre y nunca puede desfichar.
  const myEntries = clockEntries.filter(e => e.workerName.toLowerCase() === currentWorkerObj.name.toLowerCase());
  const activeShift = getActiveShiftForWorker(clockEntries, currentWorkerObj.name);

  // Calculate elapsed time if in shift
  let elapsedTimeFormatted = '0h 00m 00s';
  let elapsedHours = 0;
  if (activeShift) {
    const startTime = new Date(activeShift.timestamp);
    const diffMs = Math.max(0, currentTime - startTime);
    elapsedHours = diffMs / (1000 * 60 * 60);
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    elapsedTimeFormatted = `${hours}h ${minutes}m ${seconds}s`;
  }

  // Total hours worked in registered past shifts
  const totalCompletedHours = myEntries.reduce((acc, entry) => {
    if (entry.type === 'salida' && entry.durationHours) {
      return acc + (Number(entry.durationHours) || 0);
    }
    return acc;
  }, 0);

  // Standard 7 Days Definition
  // Títulos y números de día salen de meta.dateRange de la semana activa
  // (getDayLabel) — antes estaban escritos a mano ("Lunes 14"... "Domingo
  // 20") y la semana siguiente habrían enseñado fechas de la anterior. El
  // 'lunes' de esta lista es el de COLA de la semana (día siguiente al
  // domingo), no el que la abre. 'domingo' agrupa domingo Y lunes (misma
  // lista), y su título lo dice.
  const dayLabel = (key) => getDayLabel(activeWeekData, key, currentTime);
  const dayNumber = (key) => dayLabel(key).replace(/^\D+/, '');
  const weekDays = [
    { key: 'lunes', label: 'LUN', date: dayNumber('lunes'), title: dayLabel('lunes'), badge: 'Devoluciones & Limpieza' },
    { key: 'martes', label: 'MAR', date: dayNumber('martes'), title: activeWeekData.schedule?.martes?.title || dayLabel('martes'), badge: activeWeekData.schedule?.martes?.badge || 'Arranque Flota' },
    { key: 'miercoles', label: 'MIÉ', date: dayNumber('miercoles'), title: activeWeekData.schedule?.miercoles?.title || dayLabel('miercoles'), badge: activeWeekData.schedule?.miercoles?.badge || 'Descarga Fincas' },
    { key: 'jueves', label: 'JUE', date: dayNumber('jueves'), title: activeWeekData.schedule?.jueves?.title || dayLabel('jueves'), badge: activeWeekData.schedule?.jueves?.badge || 'Eventos' },
    { key: 'viernes', label: 'VIE', date: dayNumber('viernes'), title: activeWeekData.schedule?.viernes?.title || dayLabel('viernes'), badge: activeWeekData.schedule?.viernes?.badge || 'Cierre Crítico' },
    { key: 'sabado', label: 'SÁB', date: dayNumber('sabado'), title: dayLabel('sabado'), badge: getWeddingsBadge(activeWeekData) },
    { key: 'domingo', label: 'DOM', date: dayNumber('domingo'), title: `${dayLabel('domingo')} y ${dayLabel('lunes')}`, badge: 'Descarga & Vajilla' }
  ];

  // Helper to extract assigned tasks & weddings for a day for current worker
  const getDayActivities = (dayKey) => {
    let tasks = [];
    let weddings = [];

    const isAssigned = (t) => isTaskAssignedTo(t, currentWorkerObj.name);

    if (['martes', 'miercoles', 'jueves', 'viernes'].includes(dayKey)) {
      const dayObj = activeWeekData.schedule?.[dayKey];
      if (dayObj && dayObj.tasks) {
        tasks = dayObj.tasks.filter(isAssigned).filter(t => typeof t === 'object' ? t.active !== false : true);
      }
    } else if (dayKey === 'sabado') {
      const wList = activeWeekData.saturdaySpecial?.weddings || [];
      weddings = wList.filter(isAssigned).filter(w => w.active !== false);
    } else if (dayKey === 'domingo' || dayKey === 'lunes') {
      // domingo y lunes comparten sundayMonday.tasks bajo un único bucket
      // real ('domingo' es la clave de storage) — confirmado con el
      // usuario que la pestaña "LUN" debe enseñar las mismas tareas que
      // "DOM", no quedarse vacía como antes (buscaba en schedule.lunes,
      // que no existe).
      tasks = getTaskListForDay(activeWeekData, 'domingo').filter(isAssigned).filter(t => typeof t === 'object' ? t.active !== false : true);
      // Una tarea etiquetada "Domingo" (targetDay) no es del lunes: sin este
      // filtro la pestaña LUN enseñaba p.ej. la recogida del domingo bajo
      // "Lunes". Las sin etiquetar siguen en ambas (no se sabe cuál es).
      if (dayKey === 'lunes') {
        tasks = tasks.filter(t => !(typeof t === 'object' && String(t.targetDay || '').toLowerCase() === 'domingo'));
      }
    }

    return { tasks, weddings, totalCount: tasks.length + weddings.length };
  };

  // Resuelve el índice REAL de una tarea dentro de su lista de origen —
  // schedule[dayKey].tasks para los días normales, sundayMonday.tasks para
  // "domingo" (que agrupa domingo Y lunes bajo esa misma clave, igual que
  // getDayActivities). Las listas que se muestran en pantalla (dayGroup.tasks,
  // day.tasks de daysWithActivities) están filtradas por trabajador, así que
  // el índice que se ve ahí NUNCA es el índice real — hay que volver a
  // buscarlo por texto contra la lista completa antes de tocar el planning.
  const resolveRealTaskIndex = (dayKey, taskText) => resolveTaskIndexByText(activeWeekData, dayKey, taskText);

  // Build full activities per day
  const daysWithActivities = weekDays.map(day => {
    const act = getDayActivities(day.key);
    return { ...day, ...act };
  });

  // 'lunes' comparte bucket con 'domingo' (misma tarea, mismo texto) —
  // se usa para totales/recuentos en vez de daysWithActivities directo,
  // para no contar dos veces las tareas de domingo/lunes (una por cada
  // pestaña). 'domingo' sí se cuenta normal, es la única entrada real.
  const daysWithActivitiesForTotals = daysWithActivities.filter(d => d.key !== 'lunes');

  // Calculate total assigned tasks & completion stats across week
  const totalAssignedTasks = daysWithActivitiesForTotals.reduce((acc, d) => acc + d.totalCount, 0);
  const completedTasksCount = daysWithActivitiesForTotals.reduce((acc, d) => {
    const completed = d.tasks.filter(t => typeof t === 'object' && t.completed).length;
    return acc + completed;
  }, 0);

  // Auto-detect immediate / first pending task for ZERO-SCROLL instant clock-in
  // Se recalcula cada minuto (no cada segundo) para que una tarea que ya
  // terminó deje de ser "la siguiente" sin tener que recargar.
  const minuteKey = Math.floor(currentTime.getTime() / 60000);
  const immediateTask = useMemo(() => {
    if (activeShift) {
      return {
        isShiftActive: true,
        taskName: activeShift.taskName || 'Turno Activo General',
        dayTitle: 'Turno en curso',
        dayBadge: '🔴 En Directo',
        timeFrame: elapsedTimeFormatted,
        isWedding: false
      };
    }

    // La SIGUIENTE tarea: la que empieza antes entre las que ni están
    // completadas ni han terminado ya (daysWithActivitiesForTotals excluye
    // 'lunes' para no contar dos veces la lista compartida domingo/lunes).
    // Antes era "la primera sin completar por orden de día", y una boda de
    // sábado ya pasada se quedaba fijada como "siguiente" para siempre, así
    // que "iniciar jornada" nunca esperaba a la hora de la tarea real. Se
    // ordena por hora de inicio real porque la lista compartida mezcla
    // tareas de domingo y de lunes en cualquier orden.
    const candidates = [];
    for (const day of daysWithActivitiesForTotals) {
      for (const t of day.tasks) {
        if (isTaskEffectivelyDone(activeWeekData, day.key, t, currentTime)) continue;
        candidates.push({ day, t, isWedding: false });
      }
      for (const w of day.weddings || []) {
        if (isTaskEffectivelyDone(activeWeekData, day.key, w, currentTime)) continue;
        candidates.push({ day, t: w, isWedding: true });
      }
    }
    const startOf = ({ day, t }) => getNextTaskStart(activeWeekData, day.key, t, currentTime)?.getTime() ?? Infinity;
    candidates.sort((a, b) => {
      const sa = startOf(a);
      const sb = startOf(b);
      return sa === sb ? 0 : sa < sb ? -1 : 1;
    });

    const next = candidates[0];
    if (!next) return null;
    const { day, t } = next;
    if (next.isWedding) {
      return {
        isShiftActive: false,
        dayKey: day.key,
        dayTitle: day.title,
        dayBadge: 'Boda Fin de Semana',
        taskName: getWeddingTaskName(t),
        timeFrame: t.timeFrame,
        location: t.location,
        rawTask: t,
        isWedding: true
      };
    }
    const text = typeof t === 'object' ? t.text : t;
    return {
      isShiftActive: false,
      dayKey: day.key,
      taskIndex: resolveRealTaskIndex(day.key, text),
      dayTitle: day.title,
      dayBadge: day.badge,
      taskName: text,
      timeFrame: typeof t === 'object' ? t.timeFrame : null,
      location: typeof t === 'object' ? t.location : null,
      mapsUrl: typeof t === 'object' ? t.mapsUrl : null,
      rawTask: t,
      isWedding: false
    };
  }, [daysWithActivities, activeShift, elapsedTimeFormatted, minuteKey]);

  // Compañeros de la MISMA tarea (no cualquiera fichado en algo sin
  // relación) — para saber a quién preguntar por compartir coche a la
  // misma sede a cargar o descargar. Se saca de `assigned` de la tarea
  // actual/próxima, no de quién esté fichado ahora en general (eso podía
  // enseñar a alguien trabajando en otra cosa sin ninguna relación).
  const referenceTaskAssigned = (() => {
    if (activeShift?.taskRef) {
      const { dayKey, taskIndex } = activeShift.taskRef;
      const list = getTaskListForDay(activeWeekData, dayKey);
      const t = list[taskIndex];
      return (t && typeof t === 'object' && Array.isArray(t.assigned)) ? t.assigned : null;
    }
    if (!activeShift && immediateTask?.rawTask && Array.isArray(immediateTask.rawTask.assigned)) {
      return immediateTask.rawTask.assigned;
    }
    return null;
  })();

  // Memoizado por clockEntries: este componente también tiene un timer de
  // 1s (currentTime) que fuerza re-render, igual que en LiveMonitorPanel.
  const { activeShifts: clockedInNow } = useMemo(() => pairShiftsFromEntries(clockEntries), [clockEntries]);
  const taskCoworkers = (referenceTaskAssigned || [])
    .filter(name => name.toLowerCase() !== currentWorkerObj.name.toLowerCase())
    .map(name => ({
      name,
      profile: workersList.find(w => w.name.toLowerCase() === name.toLowerCase()),
      isClockedIn: Object.keys(clockedInNow).some(n => n.toLowerCase() === name.toLowerCase())
    }));

  // Saturday special check
  const saturdayWeddings = (activeWeekData.saturdaySpecial?.weddings || []).filter(w => 
    w.details.toLowerCase().includes(currentWorkerObj.name.toLowerCase()) ||
    w.truck.toLowerCase().includes(currentWorkerObj.name.toLowerCase())
  );

  const todayIndex = new Date().getDay();
  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const todayKey = dayNames[todayIndex];

  // Para deshabilitar "Fichar" en un día que todavía no ha llegado (evita
  // fichar por error una tarea de dentro de varios días). Compara por
  // orden de día de la semana (lunes→domingo), el mismo criterio que ya
  // usa "Hoy" (todayKey) arriba — no por fecha exacta del calendario.
  const weekDayOrder = weekDays.map(d => d.key);
  const todayOrdinal = weekDayOrder.indexOf(todayKey);
  const isDayInFuture = (dayKey) => {
    // Por FECHA REAL cuando la semana tiene fechas legibles: así una semana
    // futura entera sale bloqueada (por día de la semana suelto, el martes
    // de la semana que viene "ya había llegado" un domingo por la noche).
    const dayDate = resolveTaskDate(getWeekRange(activeWeekData, currentTime), dayKey);
    if (dayDate) {
      const today = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
      return dayDate.getTime() > today.getTime();
    }
    const ordinal = weekDayOrder.indexOf(dayKey);
    if (ordinal === -1 || todayOrdinal === -1) return false;
    // 'domingo' es el último elemento de weekDayOrder (ordinal más alto) —
    // comprobado ya en lunes, `ordinal > todayOrdinal` (6 > 0) lo marcaría
    // como "futuro" cuando en realidad fue AYER. Mismo bug que ya se
    // corrigió en taskPlanning.js para isTaskChronologicallyPast — aquí se
    // aplica el mismo criterio de "ayer exactamente" antes del corte.
    const isExactlyYesterday = ((todayOrdinal - ordinal + weekDayOrder.length) % weekDayOrder.length) === 1;
    if (isExactlyYesterday) return false;
    return ordinal > todayOrdinal;
  };

  // Filtered days list based on selected tab. En "Todos" se usa la lista
  // sin 'lunes' (daysWithActivitiesForTotals) para no mostrar la misma
  // tarjeta de domingo/lunes duplicada dos veces seguidas — seleccionando
  // la pestaña "LUN" directamente sí se sigue viendo (usa la lista
  // completa, esa sí incluye su propia entrada).
  // NUEVO COMPORTAMIENTO: Para que el trabajador no tenga que hacer scroll,
  // ordenamos los días colocando HOY y los días futuros primero, y enviamos
  // los días pasados (ya completados) al final.
  const displayedDays = selectedDayKey === 'all'
    ? [...daysWithActivitiesForTotals].sort((a, b) => {
        const isPast = (dayKey) => dayKey !== todayKey && !isDayInFuture(dayKey);
        const aPast = isPast(a.key);
        const bPast = isPast(b.key);
        if (aPast && !bPast) return 1;
        if (!aPast && bPast) return -1;
        return 0;
      })
    : daysWithActivities.filter(d => d.key === selectedDayKey);

  // domingo y lunes comparten sundayMonday.tasks bajo un único bucket real
  // ('domingo' es la clave de storage) — toStorageDayKey evita repetir esa
  // conversión al leer/escribir la lista real (findTaskIndex, toggle,
  // taskRef).
  const toStorageDayKey = (dayKey) => (dayKey === 'lunes' ? 'domingo' : dayKey);
  // Un turno solo se puede EMPEZAR desde 5 min antes de que empiece la
  // siguiente tarea (isTaskTooEarlyToStart): el primero del día Y el de cada
  // vuelta de una jornada partida (tras la pausa, la primera tarea del
  // siguiente tramo). NO tarea a tarea: con un turno en curso se puede
  // cambiar de tarea cuando se quiera. Es la misma puerta para el botón de
  // iniciar jornada y para los "Fichar esta tarea" mientras no haya turno.
  const jornadaStarted = !!activeShift;
  const firstTaskStart = jornadaStarted || !immediateTask?.dayKey
    ? null
    : getNextTaskStart(activeWeekData, immediateTask.dayKey, immediateTask.rawTask, currentTime);
  const jornadaGateClosed = !!firstTaskStart && isTaskTooEarlyToStart(activeWeekData, immediateTask.dayKey, immediateTask.rawTask, currentTime);
  const gateText = () => {
    const opens = new Date(firstTaskStart.getTime() - 5 * 60 * 1000);
    const hhmm = formatTimeShort(opens);
    return opens.toDateString() === currentTime.toDateString()
      ? `Podrás fichar a partir de las ${hhmm}`
      : `Podrás fichar el ${formatWeekdayDay(opens)} a las ${hhmm}`;
  };

  // Lo que se ve marcado = lo que hace el clic = lo que guarda el sistema
  // (isTaskEffectivelyDone): hecha si está marcada, o si pasó su hora + margen y
  // nadie la desmarcó a propósito. Compara contra la FECHA REAL de la tarea
  // (meta.dateRange) y respeta su targetDay; una sin etiquetar cuenta como lunes.
  const isTaskDone = (dayKey, task) => isTaskEffectivelyDone(activeWeekData, dayKey, task, currentTime);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn w-full max-w-full overflow-x-hidden">
      
      {/* 1. Worker Personal Profile Header Card - Compact & Clean */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
              {currentWorkerObj.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight font-['Outfit'] truncate">
                  Hola, {currentWorkerObj.name} 👋
                </h1>
                {activeShift ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    <span>EN TURNO</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span>Descanso</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-300">{currentWorkerObj.role}</span>
                <span>•</span>
                <span className="text-amber-300 truncate font-medium">{currentWorkerObj.truck}</span>
                <span>•</span>
                <span className="font-mono text-emerald-400 font-bold">{formatearHoras(totalCompletedHours)} esta semana</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto w-full sm:w-auto justify-end mt-1 sm:mt-0">
            {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
              <button
                onClick={handleSubscribePush}
                disabled={pushStatus === 'loading'}
                className="py-2 px-3 rounded-xl bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-bold transition-colors flex items-center space-x-1.5"
                title="Recibe alertas cuando se añadan o cambien tus turnos"
              >
                <Bell className={`w-3.5 h-3.5 ${pushStatus === 'loading' ? 'animate-pulse' : 'animate-bounce'}`} />
                <span className="hidden sm:inline">{pushStatus === 'loading' ? 'Activando...' : 'Activar Alertas'}</span>
                <span className="sm:hidden">{pushStatus === 'loading' ? '...' : 'Alertas'}</span>
              </button>
            )}

            {onOpenAdminDashboard && (
              isAdmin ? (
                <button
                  onClick={onOpenAdminDashboard}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition-colors flex items-center space-x-1.5 shrink-0"
                >
                  <Settings className="w-4 h-4 hover:rotate-90 transition-transform duration-300" />
                  <span className="hidden sm:inline">Administración</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAdminDashboard}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors shrink-0 px-2 py-1"
                  title="Acceso Admin (Oculto)"
                >
                  Admin
                </button>
              )
            )}
          </div>
        </div>
        {/* 🎯 HERO ACTION CARD: IMMEDIATE TASK (0 SCROLL REQUIRED!) */}
        <div className={`mt-3 rounded-2xl p-4 sm:p-5 border transition-all ${
          activeShift
            ? 'bg-gradient-to-r from-rose-950/60 via-slate-950 to-rose-950/40 border-rose-500/50 shadow-xl shadow-rose-950/30'
            : immediateTask
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-950 to-amber-950/30 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          {activeShift ? (
            /* ACTIVE SHIFT: Live Clock-Out Button */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-rose-500/20 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                    TURNO ACTIVO EN CURSO
                  </span>
                </div>
                <span className="text-sm sm:text-base font-extrabold font-mono text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
                  <Clock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{elapsedTimeFormatted}
                </span>
              </div>

              <div>
                <p className="text-sm sm:text-base font-extrabold text-white font-['Outfit']">
                  <Pin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{activeShift.taskName === 'JORNADA' ? 'Jornada Laboral Iniciada' : (activeShift.taskName || 'Turno Operativo General')}
                </p>
              </div>

              {/* Sub-tareas V2 */}
              {activeShift.taskName === 'JORNADA' && (
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mt-2">
                  <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2 mb-2">
                    <div className="flex items-center space-x-1.5 text-emerald-400">
                      <Target className="w-4 h-4" />
                      <span className="text-[11px] font-black uppercase tracking-wider">TAREA EN CURSO</span>
                    </div>
                  </div>
                  
                  {immediateTask ? (
                    <>
                      <p className="text-xs font-bold text-white mb-3">{immediateTask.taskName}</p>
                      {(() => {
                        const isLocked = immediateTask.dayKey && isDayInFuture(immediateTask.dayKey);
                        return (
                          <button
                            onClick={() => {
                              if (isLocked) return;
                              const tRef = !immediateTask.isWedding && immediateTask.dayKey && immediateTask.taskIndex != null
                                ? { dayKey: immediateTask.dayKey, taskIndex: immediateTask.taskIndex }
                                : null;

                              onClockEntryCreated(crearFichaje({
                                trabajador: currentWorkerObj,
                                tipo: 'fichaje',
                                taskName: immediateTask.taskName.trim(),
                                note: '',
                                taskRef: tRef
                              }));
                            }}
                            disabled={isLocked}
                            className={`w-full py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
                              isLocked
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 active:scale-95'
                            }`}
                          >
                            {isLocked ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Esperando día...</span>
                              </>
                            ) : (
                              <>
                                <CheckSquare className="w-3.5 h-3.5" />
                                <span>Marcar Tarea como COMPLETADA</span>
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <span className="text-xs font-bold text-slate-400 block">
                        🎉 ¡Estás al día! No tienes tareas pendientes hoy.
                      </span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => { 
                  onClockEntryCreated(crearFichaje({ trabajador: currentWorkerObj, tipo: 'salida', note: '' }));
                }}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-extrabold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center space-x-2 transition-all shadow-xl shadow-rose-600/30 active:scale-95"
              >
                <Square className="w-4 h-4" />
                <span>{activeShift.taskName === 'JORNADA' ? 'FINALIZAR JORNADA' : 'Fichar Salida / Finalizar Turno'}</span>
              </button>

              {/* BOTÓN DESHACER: Disponible solo durante los primeros 15 min */}
              {activeShift && (new Date() - new Date(activeShift.timestamp) < 15 * 60 * 1000) && (
                <button
                  onClick={() => {
                    if (window.confirm('¿Seguro que quieres anular este fichaje de entrada? Hazlo solo si le diste por error.')) {
                      onDeleteClockEntry(activeShift.id);
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors border border-slate-700"
                >
                  Deshacer Entrada (Me he equivocado)
                </button>
              )}
            </div>
          ) : (
            /* INICIAR JORNADA BUTTON (No active shift) */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider">
                    FUERA DE TURNO
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit'] leading-snug">
                  ¿Listo para empezar el día?
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Inicia tu jornada general. Luego podrás ir marcando las tareas que termines.
                </p>
              </div>

              {(() => {
                // La puerta (jornadaGateClosed) mira la fecha REAL de la primera
                // tarea, no solo la hora de hoy: una tarea de un día futuro no
                // deja iniciar jornada antes de tiempo.
                const isReady = !jornadaGateClosed;
                const minutesLeft = isReady ? 0 : Math.max(1, Math.ceil((firstTaskStart.getTime() - currentTime.getTime()) / 60000 - 5));
                const waitText = minutesLeft >= 60 ? `${Math.floor(minutesLeft / 60)} h ${minutesLeft % 60} min` : `${minutesLeft} min`;

                return (
                  <button
                    disabled={!isReady}
                    onClick={() => {
                      onClockEntryCreated(crearFichaje({
                        trabajador: currentWorkerObj,
                        tipo: 'entrada',
                        taskName: 'JORNADA',
                        note: 'Inicio de Jornada',
                        taskRef: null
                      }));
                    }}
                    className={`w-full py-3.5 px-4 rounded-xl text-sm font-extrabold flex items-center justify-center space-x-2 transition-all ${
                      isReady 
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-95' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    {isReady ? (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>{startLabel}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-4 h-4" />
                        <span>Espera {waitText} para fichar</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-800 text-[11px] text-slate-400">
            <button
              onClick={() => {
                setPrefilledTask(null);
                setTaskRef(null);
                setIsClockModalOpen(true);
              }}
              className="hover:text-amber-400 text-slate-300 underline decoration-slate-700 hover:decoration-amber-400 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />O fichar otra tarea libre
            </button>
            <span className="text-[10px] text-slate-500">
              <Lock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Registro seguro
            </span>
          </div>
        </div>
      </div>

      {/* Compañeros de esta tarea — para saber a quién preguntar por si
          compartir coche a la misma sede a cargar/descargar */}
      {taskCoworkers.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-400">
            <Users className="w-4 h-4" />
            <span className="text-[11px] font-black uppercase tracking-wider">
              Contigo en esta tarea
            </span>
            <Car className="w-3.5 h-3.5 text-slate-500 ml-auto shrink-0" />
          </div>
          <div className="flex flex-wrap gap-2">
            {taskCoworkers.map(({ name, profile, isClockedIn }) => (
              <div
                key={name}
                className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 min-w-0"
              >
                <span className="text-base shrink-0">{profile?.avatar || '👤'}</span>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">{name}</span>
                  <span className={`text-[10px] block truncate ${isClockedIn ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                    {isClockedIn ? '🟢 Ya ha fichado' : 'Aún no ha fichado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Clean Segmented Navigation Tabs (Mis Tareas vs Mis Fichajes) */}
      <div className="flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setWorkerTab('tasks')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
            workerTab === 'tasks'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Mis Tareas ({totalAssignedTasks})</span>
        </button>

        <button
          onClick={() => setWorkerTab('history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
            workerTab === 'history'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Mis Fichajes ({myEntries.length})</span>
        </button>
      </div>

      {workerTab === 'tasks' && (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        
        {/* Header & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[9px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Planificación
              </span>
              <span className="text-[11px] text-slate-400">{activeWeekData?.meta?.dateRange}</span>
            </div>
            <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight font-['Outfit'] mt-0.5 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Cuadrante de la Semana (7 Días)</span>
            </h2>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setViewModeType('calendar');
              }}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                viewModeType === 'calendar'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Calendario
            </button>

            <button
              onClick={() => setViewModeType('graph')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all border ${
                viewModeType === 'graph'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 inline mr-1" />
              <span>Grafo</span>
            </button>
          </div>
        </div>

        {viewModeType === 'graph' ? (
          <TaskFlowGraphView activeWeekData={activeWeekData} workersList={workersList} onToggleTask={onToggleTask} restrictToWorkerName={currentWorkerObj.name} />
        ) : (
          <>
            {/* HORIZONTAL SCROLLABLE DAY PILLS BAR */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-1 px-1">
              <button
                onClick={() => setSelectedDayKey(todayKey)}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
                  selectedDayKey === todayKey
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 text-slate-200 border-slate-800 hover:text-white'
                }`}
              >
                <span><Zap className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Hoy ({weekDays.find(d => d.key === todayKey)?.label || 'Hoy'})</span>
              </button>

              <button
                onClick={() => setSelectedDayKey('all')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 border ${
                  selectedDayKey === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Toda la Semana ({totalAssignedTasks})
              </button>

              {daysWithActivities.map((day) => {
                const isSelected = selectedDayKey === day.key;
                const hasActivity = day.totalCount > 0;
                const isSaturday = day.key === 'sabado';
                const isToday = day.key === todayKey;

                return (
                  <button
                    key={day.key}
                    onClick={() => setSelectedDayKey(day.key)}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-105'
                        : hasActivity
                        ? isSaturday
                          ? 'bg-amber-950/30 text-amber-300 border-amber-500/40 hover:border-amber-400'
                          : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-amber-500/40'
                        : 'bg-slate-950/40 text-slate-500 border-slate-800/60'
                    }`}
                  >
                    <span>{day.label} {day.date}</span>
                    {isToday && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-extrabold">
                        HOY
                      </span>
                    )}
                    {day.totalCount > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isSelected ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-300'
                      }`}>
                        {day.totalCount}
                      </span>
                    )}
                    {isSaturday && <span>👑</span>}
                  </button>
                );
              })}
            </div>

            {/* DETAILED TASKS & WEDDINGS BREAKDOWN ACCORDING TO SELECTED DAY */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <span>
                    {selectedDayKey === 'all' 
                      ? 'Desglose Completo de tu Cuadrante Semanal' 
                      : `Tareas Asignadas para ${weekDays.find(d => d.key === selectedDayKey)?.title}`}
                  </span>
                </h3>
                <span className="text-[11px] sm:text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  {displayedDays.filter(d => d.totalCount > 0).length} días con asignación directa
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 sm:gap-4">
                {displayedDays.map((dayGroup) => {
                  if (dayGroup.totalCount === 0 && selectedDayKey === 'all') return null;

                  return (
                    <div 
                      key={dayGroup.key} 
                      className={`bg-slate-950 border p-4 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 transition-all ${
                        dayGroup.weddings.length > 0
                          ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/20'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <h4 className="font-extrabold text-amber-300 text-sm sm:text-base font-['Outfit']">
                            <Calendar className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{dayGroup.title}
                          </h4>
                          <span className="text-[11px] text-slate-400 block mt-0.5">{dayGroup.badge}</span>
                        </div>

                        <span className="text-[10px] bg-slate-900 text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
                          {dayGroup.totalCount} {dayGroup.totalCount === 1 ? 'tarea' : 'tareas'}
                        </span>
                      </div>

                      {/* Tasks List */}
                      {dayGroup.tasks.length > 0 && (
                        <ul className="space-y-2 text-xs text-slate-200">
                          {dayGroup.tasks.map((task, idx) => (
                            <WorkerViewTaskItem
                              key={idx}
                              task={task}
                              dayKey={dayGroup.key}
                              isCompleted={isTaskDone(dayGroup.key, task)}
                              isDayInFuture={isDayInFuture(dayGroup.key)}
                              jornadaGateClosed={jornadaGateClosed}
                              gateText={gateText()}
                              onToggleTask={onToggleTask}
                              toStorageDayKey={toStorageDayKey}
                              resolveRealTaskIndex={resolveRealTaskIndex}
                              onClockIn={(label, ref) => {
                                setPrefilledTask(label);
                                setTaskRef(ref);
                                setIsClockModalOpen(true);
                              }}
                            />
                          ))}
                        </ul>
                      )}

                      {/* Saturday Weddings assigned */}
                      {dayGroup.weddings.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center space-x-1">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            <span>Boda Asignada Sábado</span>
                          </span>
                          {dayGroup.weddings.map((w, idx) => (
                            <WorkerViewWeddingCard
                              key={idx}
                              wedding={w}
                              isCompleted={isTaskDone('sabado', w)}
                              isDayInFuture={isDayInFuture('sabado')}
                              jornadaGateClosed={jornadaGateClosed}
                              gateText={gateText()}
                              onToggleTask={onToggleTask}
                              resolveRealTaskIndex={resolveRealTaskIndex}
                              getWeddingTaskName={getWeddingTaskName}
                              onClockIn={(label, ref) => {
                                setPrefilledTask(label);
                                setTaskRef(ref);
                                setIsClockModalOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {dayGroup.totalCount === 0 && (
                        <p className="text-xs text-slate-500 italic text-center py-4">
                          Sin tareas directas asignadas para este día. Estás en backup u operativa general de base.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* SECTION: REGISTERED CLOCK ENTRIES HISTORY */}
      {workerTab === 'history' && (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-lg sm:text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
            <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Mi Historial de Fichajes Registrados</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hidden sm:inline-block">
              {myEntries.length} fichajes enviados
            </span>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center space-x-1 shadow-md shadow-amber-500/20 transition-all active:scale-95"
            >
              <span>+ Añadir Manual</span>
            </button>
          </div>
        </div>

        {myEntries.length === 0 ? (
          <EstadoVacio icono={Clock} titulo="Aún no has registrado ningún fichaje de entrada o salida esta semana." className="py-8 bg-slate-950/60" />
        ) : (
          <>
            {/* Mobile Card Layout (sm:hidden) */}
            <div className="block sm:hidden space-y-2.5">
              {myEntries.map((entry) => (
                <div key={entry.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white">
                      {horaDeFichaje(entry)} <span className="text-[10px] text-slate-400 font-normal">({fechaDeFichaje(entry)})</span>
                    </span>
                    {entry.type === 'entrada' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                        🟢 ENTRADA
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/30 font-bold">
                        🔴 SALIDA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    <Pin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{entry.taskName || entry.note || 'Turno General'}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                    <span className="text-[10px] text-slate-400">
                      {entry.durationHours ? `Duración: ${formatearHoras(Number(entry.durationHours))}` : 'Turno registrado'}
                    </span>
                    <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" /> Bloqueado
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Fecha & Hora</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Tarea / Concepto</th>
                    <th className="py-3 px-3">Estado</th>
                    <th className="py-3 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {myEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-200">
                        <div className="font-bold text-white">{horaDeFichaje(entry)}</div>
                        <div className="text-[10px] text-slate-500">{fechaDeFichaje(entry)}</div>
                      </td>
                      <td className="py-3 px-3">
                        {entry.type === 'entrada' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                            🟢 ENTRADA
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                            🔴 SALIDA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-medium">
                        {entry.taskName || entry.note || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-flex items-center space-x-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>Guardado</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-[10px] font-bold text-amber-300">
                        Solo Admin
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      )}

      {/* Clock In Modal for worker */}
      <ClockInModal
        isOpen={isClockModalOpen}
        onClose={() => { setIsClockModalOpen(false); setPrefilledTask(null); setTaskRef(null); }}
        workersList={workersList}
        initialWorkerName={currentWorkerObj.name}
        initialTaskName={prefilledTask}
        taskRef={taskRef}
        clockEntries={clockEntries}
        onClockEntryCreated={onClockEntryCreated}
      />

      {/* Modal para AÑADIR (nunca editar/borrar) un fichaje manual olvidado */}
      <AdminClockEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        entry={null}
        workersList={[currentWorkerObj]}
        isAdmin={false}
        onClockEntryCreated={onClockEntryCreated}
      />

    </div>
  );
}
