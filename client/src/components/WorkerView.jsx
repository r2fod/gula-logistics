import React, { useState, useEffect, useMemo } from 'react';
import { Bell, Calendar, Car, Clock, Settings, Users, Zap } from 'lucide-react';
import ClockInModal from './ClockInModal';
import TaskFlowGraphView from './TaskFlowGraphView';
import AdminClockEditModal from './AdminClockEditModal';
import ResumenHorasSaldo from './dashboard/ResumenHorasSaldo';
import { getActiveShiftForWorker, pairShiftsFromEntries, sortEntriesByTimestamp } from '../data/shiftCalculations';
import { getTaskListForDay, resolveTaskIndex, isTaskEffectivelyDone, getNextTaskStart, isTaskTooEarlyToStart, refDeTareaFichada } from '../data/taskPlanning';
import { subscribeToPush } from '../data/pushService';
import HistorialFichajes from './trabajador/HistorialFichajes';
import TarjetaFichar from './trabajador/TarjetaFichar';
import CuadranteDias from './trabajador/CuadranteDias';
import AvisoFichajesPrivados from './AvisoFichajesPrivados';
import { useAhora } from '../hooks/useAhora';
import { mismoNombre } from '../data/nombresTrabajadores';
import {
  agendaDeLaSemana, sinLunesRepetido, proximaTareaDe, diaDeHoy, esDiaFuturo, diasParaVer,
  textoDePuerta, companerosDeTarea,
} from '../data/agendaTrabajador';

export default function WorkerView({
  workerName,
  workersList = [],
  activeWeekData = {},
  clockEntries = [],
  fichajesDeTodo = [],
  lecturaFichajes = null, // 'todos' | 'propios' | 'ninguna' (accesoAFichajes)
  isAdmin = false,
  onToggleTask,
  onClockEntryCreated,
  onDeleteClockEntry,
  onOpenAdminDashboard
}) {
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [prefilledTask, setPrefilledTask] = useState(null); // for task-level clock-in
  const [taskRef, setTaskRef] = useState(null); // { dayKey, taskIndex } — para marcar la tarea como hecha al fichar salida
  // La pantalla se recalcula cada 15 s (tarea siguiente, "espera X min para fichar"…);
  // el cronómetro del turno va aparte en <EnVivo>. Antes se redibujaba entera cada
  // segundo, que en un móvil modesto se nota.
  const currentTime = useAhora(15000);
  // 'hoy' = el día de hoy de la semana que se ve, o toda la semana si hoy no cae en ella
  // (se resuelve abajo, cuando ya se sabe qué semana es: diaElegido).
  const [selectedDayKey, setSelectedDayKey] = useState('hoy');
  const [viewModeType, setViewModeType] = useState('calendar'); // 'calendar' | 'graph'
  const [workerTab, setWorkerTab] = useState('tasks'); // 'tasks' | 'history'
  // Solo para AÑADIR un fichaje manual olvidado (POST, sin admin) — nunca
  // para editar/borrar uno ya enviado: eso está bloqueado y solo puede
  // hacerlo Administración (el servidor lo exige en clock.routes.js).
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const safeClockEntry = async (entryFn) => {
    if (isProcessingAction) return;
    setIsProcessingAction(true);
    try {
      await onClockEntryCreated(entryFn());
    } finally {
      setTimeout(() => setIsProcessingAction(false), 500);
    }
  };

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

  const currentWorkerObj = workersList.find(w => mismoNombre(w.name, workerName)) || {
    name: workerName,
    role: "Operativa Logística",
    avatar: "👤",
    truck: "Flota Gula",
    isPayroll: false
  };

  useEffect(() => {
    if (pushStatus === 'granted') {
      // Si ya hay permiso, nos aseguramos de que haya suscripción en el backend
      // por si es un dispositivo nuevo o limpió datos.
      subscribeToPush(currentWorkerObj.name).catch(console.error);
    }
  }, [pushStatus, currentWorkerObj.name]);

  // Worker's own active shift. El servidor devuelve los fichajes más
  // recientes primero (para el historial), así que "el último del array"
  // NO es "el más reciente" — hay que mirar el orden cronológico real
  // (ver getActiveShiftForWorker), si no un trabajador con 2+ fichajes
  // históricos queda con su primera entrada de siempre marcada como activa
  // para siempre y nunca puede desfichar.
  // Lo más reciente arriba: un fichaje nuevo se añade al final de la lista y salía abajo
  // del todo hasta la siguiente sincronización completa.
  const myEntries = sortEntriesByTimestamp(clockEntries.filter(e => mismoNombre(e.workerName, currentWorkerObj.name))).reverse();
  const activeShift = getActiveShiftForWorker(clockEntries, currentWorkerObj.name);

  // Cuánto duró cada turno de la semana, emparejando entrada y salida como en Saldos
  // (pairShiftsFromEntries, a la media hora): ningún fichaje de salida lleva su
  // duración. Las horas de la semana y del mes las cuenta ResumenHorasSaldo.
  const duracionDeSalida = new Map(pairShiftsFromEntries(myEntries).shifts.map(turno => [turno.endEntry?.id, turno.durationHours]));

  // Resuelve el índice REAL de una tarea dentro de su lista de origen (schedule[dayKey]
  // o sundayMonday para domingo/lunes): las listas en pantalla están filtradas por
  // trabajador, así que su índice NUNCA es el real. Se le pasa la TAREA (no su texto):
  // dos con el mismo texto no se confunden (resolveTaskIndex).
  const resolveRealTaskIndex = (dayKey, tarea) => resolveTaskIndex(activeWeekData, dayKey, tarea);

  // Cada día (de martes al lunes de cola) con sus tareas y bodas; los totales van sin el
  // lunes, que comparte lista con el domingo (no se cuentan dos veces).
  const daysWithActivities = agendaDeLaSemana(activeWeekData, currentWorkerObj.name, currentTime);
  const totalAssignedTasks = sinLunesRepetido(daysWithActivities).reduce((acc, d) => acc + d.totalCount, 0);

  // La próxima tarea de este trabajador, tenga o no el turno abierto. Con el turno abierto
  // el bloque «Tarea en curso» enseña ESTA. Se recalcula en cada repintado (cada 15 s):
  // una tarea que ya terminó deja de ser «la siguiente» sin tener que recargar.
  const proximaTarea = proximaTareaDe(activeWeekData, daysWithActivities, currentTime);

  // Un turno de jornada (se ficha la entrada de la jornada y luego se van marcando las tareas):
  // su `taskName` pasa a ser el de la última tarea marcada, así que se mira su marca propia.
  const esJornada = !!activeShift?.esJornada;

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
    if (!activeShift && proximaTarea?.rawTask && Array.isArray(proximaTarea.rawTask.assigned)) {
      return proximaTarea.rawTask.assigned;
    }
    return null;
  })();

  // Memoizado por clockEntries: la vista se repinta cada 15 s (currentTime) y no hace
  // falta volver a emparejar todos los fichajes en cada repintado.
  const { activeShifts: clockedInNow } = useMemo(() => pairShiftsFromEntries(clockEntries), [clockEntries]);
  const taskCoworkers = companerosDeTarea(referenceTaskAssigned, currentWorkerObj.name, workersList, Object.keys(clockedInNow));

  // «Hoy» (null si la semana que se ve no es la de hoy) y el día elegido en las píldoras.
  const todayKey = diaDeHoy(activeWeekData, currentTime);
  const diaElegido = selectedDayKey === 'hoy' ? (todayKey || 'all') : selectedDayKey;

  // Para deshabilitar "Fichar" en un día que todavía no ha llegado (evita fichar por error
  // una tarea de dentro de varios días).
  const isDayInFuture = (dayKey) => esDiaFuturo(activeWeekData, dayKey, currentTime);

  // Con el turno abierto, la próxima tarea puede ser de otro día (hoy no le queda nada):
  // entonces no es «en curso», es la próxima, y se dice de qué día.
  const proximaEsOtroDia = !!proximaTarea?.dayKey && isDayInFuture(proximaTarea.dayKey);

  const displayedDays = diasParaVer(daysWithActivities, diaElegido, todayKey, isDayInFuture);

  // Un turno solo se puede EMPEZAR desde 5 min antes de que empiece la
  // siguiente tarea (isTaskTooEarlyToStart): el primero del día Y el de cada
  // vuelta de una jornada partida (tras la pausa, la primera tarea del
  // siguiente tramo). NO tarea a tarea: con un turno en curso se puede
  // cambiar de tarea cuando se quiera. Es la misma puerta para el botón de
  // iniciar jornada y para los "Fichar esta tarea" mientras no haya turno.
  const jornadaStarted = !!activeShift;
  const firstTaskStart = jornadaStarted || !proximaTarea?.dayKey
    ? null
    : getNextTaskStart(activeWeekData, proximaTarea.dayKey, proximaTarea.rawTask, currentTime);
  // Sin ninguna tarea pendiente tampoco se abre (evita fichar sin querer); para algo
  // que no está en el planning queda «O fichar otra tarea libre».
  const sinTareasPendientes = !jornadaStarted && !proximaTarea;
  const jornadaGateClosed = sinTareasPendientes || (!!firstTaskStart && isTaskTooEarlyToStart(activeWeekData, proximaTarea.dayKey, proximaTarea.rawTask, currentTime));
  const gateText = textoDePuerta({ sinTareasPendientes, inicioPrimeraTarea: firstTaskStart, ahora: currentTime });

  // Lo que se ve marcado = lo que hace el clic = lo que guarda el sistema
  // (isTaskEffectivelyDone): hecha solo si está marcada (a mano o al fichar su salida).
  const isTaskDone = (dayKey, task) => isTaskEffectivelyDone(activeWeekData, dayKey, task);

  const abrirFichar = (label, ref) => {
    setPrefilledTask(label);
    setTaskRef(ref);
    setIsClockModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadeIn w-full max-w-full xl:max-w-6xl 2xl:max-w-7xl mx-auto overflow-x-hidden">
      {lecturaFichajes === 'ninguna' && <AvisoFichajesPrivados vista="trabajador" />}

      {/* 1. Worker Personal Profile Header Card - Compact & Clean */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl shadow-inner shrink-0">
              {currentWorkerObj.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight font-outfit truncate">
                  Hola, {currentWorkerObj.name} 👋
                </h1>
                {activeShift ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    <span>EN TURNO</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span>Descanso</span>
                  </span>
                )}
              </div>

              {/* Sin cortar (un puesto largo pasa a otra línea); el "•" va delante del dato para no
                  quedarse colgando al final de una línea. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                <span className="min-w-0 break-words font-semibold text-slate-300">{currentWorkerObj.role}</span>
                {currentWorkerObj.truck && (
                  <span className="whitespace-nowrap text-amber-300 font-medium before:mr-2 before:text-slate-500 before:content-['•']">{currentWorkerObj.truck}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
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
                  aria-label="Administración"
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-bold transition-colors flex items-center space-x-1.5 shrink-0"
                >
                  <Settings className="w-4 h-4 hover:rotate-90 transition-transform duration-300" />
                  <span className="hidden sm:inline">Administración</span>
                </button>
              ) : (
                <button
                  onClick={onOpenAdminDashboard}
                  className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors shrink-0 px-2 py-1"
                  title="Acceso Admin (Oculto)"
                >
                  Admin
                </button>
              )
            )}
          </div>
        </div>
        {/* Sus horas de la semana y lo que tiene pendiente de cobro, en directo. */}
        <ResumenHorasSaldo
          nombre={currentWorkerObj.name}
          enNomina={!!currentWorkerObj.isPayroll}
          turnoAbierto={activeShift}
          fichajesDeTodo={fichajesDeTodo}
          equipo={workersList}
        />
        {/* Tarjeta de fichar: la acción inmediata, sin scroll */}
        <TarjetaFichar
          turno={activeShift}
          esJornada={esJornada}
          trabajador={currentWorkerObj}
          semana={activeWeekData}
          proximaTarea={proximaTarea}
          proximaEsOtroDia={proximaEsOtroDia}
          hayTarea={!!proximaTarea}
          puertaCerrada={jornadaGateClosed}
          sinTareasPendientes={sinTareasPendientes}
          inicioPrimeraTarea={firstTaskStart}
          ahora={currentTime}
          textoPuerta={gateText}
          ocupado={isProcessingAction}
          onFichar={safeClockEntry}
          onDeshacer={onDeleteClockEntry}
          onFicharLibre={() => abrirFichar(null, null)}
        />
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
                  {/* Con los fichajes privados solo llegan los propios: de los demás no se sabe. */}
                  {(!lecturaFichajes || lecturaFichajes === 'todos') && (
                    <span className={`text-[11px] block truncate ${isClockedIn ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                      {isClockedIn ? '🟢 Ya ha fichado' : 'Aún no ha fichado'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Clean Segmented Navigation Tabs (Mis Tareas vs Mis Fichajes) */}
      <div className="flex items-center space-x-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shrink-0">
        <button
          onClick={() => setWorkerTab('tasks')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
            workerTab === 'tasks'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="whitespace-nowrap">Tareas ({totalAssignedTasks})</span>
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
          <span className="whitespace-nowrap">Fichajes ({myEntries.length})</span>
        </button>
      </div>

      {workerTab === 'tasks' && (
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        
        {/* Header & View Mode Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="whitespace-nowrap text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Planificación
              </span>
              <span className="whitespace-nowrap text-[11px] text-slate-400">{activeWeekData?.meta?.dateRange}</span>
            </div>
            <h2 className="text-base sm:text-xl font-extrabold text-white tracking-tight font-outfit mt-0.5 flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <span>Cuadrante semanal</span>
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
          <div className="flex-1 flex flex-col min-h-0">
            <TaskFlowGraphView activeWeekData={activeWeekData} workersList={workersList} onToggleTask={onToggleTask} restrictToWorkerName={currentWorkerObj.name} />
          </div>
        ) : (
          <CuadranteDias
            dias={daysWithActivities}
            diasMostrados={displayedDays}
            diaElegido={diaElegido}
            hoy={todayKey}
            totalTareas={totalAssignedTasks}
            onElegirDia={setSelectedDayKey}
            estaHecha={isTaskDone}
            esDiaFuturo={isDayInFuture}
            jornadaStarted={jornadaStarted}
            puertaCerrada={jornadaGateClosed}
            textoPuerta={gateText}
            onToggleTask={onToggleTask}
            resolveRealTaskIndex={resolveRealTaskIndex}
            onFicharTarea={abrirFichar}
          />
        )}
      </div>
      )}

      {workerTab === 'history' && (
        <HistorialFichajes fichajes={myEntries} duracionDeSalida={duracionDeSalida} onAnadir={() => setIsEditModalOpen(true)} />
      )}

      {/* Clock In Modal for worker */}
      <ClockInModal
        isOpen={isClockModalOpen}
        onClose={() => { setIsClockModalOpen(false); setPrefilledTask(null); setTaskRef(null); }}
        workersList={workersList}
        initialWorkerName={currentWorkerObj.name}
        initialTaskName={prefilledTask}
        taskRef={refDeTareaFichada(activeWeekData, taskRef)}
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
