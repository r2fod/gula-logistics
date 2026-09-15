import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  MapPin, 
  Truck, 
  Lock, 
  Play, 
  Square, 
  ShieldCheck, 
  Eye, 
  Sparkles,
  DollarSign,
  ChevronRight,
  BarChart3,
  Award,
  Filter,
  Zap,
  Target,
  ArrowRight
} from 'lucide-react';
import ClockInModal from './ClockInModal';
import TaskFlowGraphView from './TaskFlowGraphView';

export default function WorkerView({
  workerName,
  workersList = [],
  activeWeekData = {},
  clockEntries = [],
  onToggleTask,
  onClockEntryCreated,
  onToggleGeneralView,
  onOpenAdminDashboard
}) {
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [prefilledTask, setPrefilledTask] = useState(null); // for task-level clock-in
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState('all');
  const [viewModeType, setViewModeType] = useState('calendar'); // 'calendar' | 'graph'

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

  // Worker's own active shift
  const myEntries = clockEntries.filter(e => e.workerName.toLowerCase() === currentWorkerObj.name.toLowerCase());
  const lastEntry = myEntries[myEntries.length - 1];
  const activeShift = (lastEntry && lastEntry.type === 'entrada') ? lastEntry : null;

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
  const weekDays = [
    { key: 'lunes', label: 'LUN', date: '14', title: 'Lunes 14', badge: 'Preparación Base' },
    { key: 'martes', label: 'MAR', date: '15', title: activeWeekData.schedule?.martes?.title || 'Martes 15', badge: activeWeekData.schedule?.martes?.badge || 'Arranque Flota' },
    { key: 'miercoles', label: 'MIÉ', date: '16', title: activeWeekData.schedule?.miercoles?.title || 'Miércoles 16', badge: activeWeekData.schedule?.miercoles?.badge || 'Descarga Fincas' },
    { key: 'jueves', label: 'JUE', date: '17', title: activeWeekData.schedule?.jueves?.title || 'Jueves 17', badge: activeWeekData.schedule?.jueves?.badge || 'Eventos' },
    { key: 'viernes', label: 'VIE', date: '18', title: activeWeekData.schedule?.viernes?.title || 'Viernes 18', badge: activeWeekData.schedule?.viernes?.badge || 'Cierre Crítico' },
    { key: 'sabado', label: 'SÁB', date: '19', title: 'Sábado 19', badge: '3 Bodas Simultáneas' },
    { key: 'domingo', label: 'DOM', date: '20', title: 'Domingo 20', badge: 'Descarga & Vajilla' }
  ];

  // Helper to extract assigned tasks & weddings for a day for current worker
  const getDayActivities = (dayKey) => {
    const nameLower = currentWorkerObj.name.toLowerCase();
    let tasks = [];
    let weddings = [];

    const isAssigned = (t) => {
      if (typeof t === 'object' && Array.isArray(t.assigned) && t.assigned.length > 0) {
        return t.assigned.some(a => a.toLowerCase() === nameLower);
      }
      const text = typeof t === 'object' ? t.text : t;
      return text.toLowerCase().includes(nameLower);
    };

    if (['martes', 'miercoles', 'jueves', 'viernes', 'lunes'].includes(dayKey)) {
      const dayObj = activeWeekData.schedule?.[dayKey];
      if (dayObj && dayObj.tasks) {
        tasks = dayObj.tasks.filter(isAssigned);
      }
    } else if (dayKey === 'sabado') {
      const wList = activeWeekData.saturdaySpecial?.weddings || [];
      weddings = wList.filter(w => {
        if (Array.isArray(w.assigned) && w.assigned.length > 0) {
          return w.assigned.some(a => a.toLowerCase() === nameLower);
        }
        return w.details.toLowerCase().includes(nameLower) || w.truck.toLowerCase().includes(nameLower);
      });
    } else if (dayKey === 'domingo') {
      const sunTasks = activeWeekData.sundayMonday?.tasks || [];
      tasks = sunTasks.filter(isAssigned);
    }

    return { tasks, weddings, totalCount: tasks.length + weddings.length };
  };

  // Build full activities per day
  const daysWithActivities = weekDays.map(day => {
    const act = getDayActivities(day.key);
    return { ...day, ...act };
  });

  // Calculate total assigned tasks & completion stats across week
  const totalAssignedTasks = daysWithActivities.reduce((acc, d) => acc + d.totalCount, 0);
  const completedTasksCount = daysWithActivities.reduce((acc, d) => {
    const completed = d.tasks.filter(t => typeof t === 'object' && t.completed).length;
    return acc + completed;
  }, 0);

  // Auto-detect immediate / first pending task for ZERO-SCROLL instant clock-in
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

    // Look for first uncompleted task across days
    for (const day of daysWithActivities) {
      for (const t of day.tasks) {
        const isCompleted = typeof t === 'object' ? t.completed : false;
        if (!isCompleted) {
          const text = typeof t === 'object' ? t.text : t;
          const timeFrame = typeof t === 'object' ? t.timeFrame : null;
          const location = typeof t === 'object' ? t.location : null;
          const mapsUrl = typeof t === 'object' ? t.mapsUrl : null;
          return {
            isShiftActive: false,
            dayKey: day.key,
            dayTitle: day.title,
            dayBadge: day.badge,
            taskName: text,
            timeFrame,
            location,
            mapsUrl,
            rawTask: t,
            isWedding: false
          };
        }
      }
      if (day.weddings && day.weddings.length > 0) {
        const w = day.weddings[0];
        return {
          isShiftActive: false,
          dayKey: day.key,
          dayTitle: day.title,
          dayBadge: 'Boda Fin de Semana',
          taskName: `Boda: ${w.location} (${w.truck})`,
          timeFrame: w.timeFrame,
          location: w.location,
          rawTask: w,
          isWedding: true
        };
      }
    }
    return null;
  }, [daysWithActivities, activeShift, elapsedTimeFormatted]);

  // Saturday special check
  const saturdayWeddings = (activeWeekData.saturdaySpecial?.weddings || []).filter(w => 
    w.details.toLowerCase().includes(currentWorkerObj.name.toLowerCase()) ||
    w.truck.toLowerCase().includes(currentWorkerObj.name.toLowerCase())
  );

  // Filtered days list based on selected tab
  const displayedDays = selectedDayKey === 'all' 
    ? daysWithActivities 
    : daysWithActivities.filter(d => d.key === selectedDayKey);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn w-full max-w-full overflow-x-hidden">
      
      {/* 1. Worker Personal Profile Header Card - Compact & Clean */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Profile Details */}
          <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl sm:text-4xl shadow-inner shrink-0">
              {currentWorkerObj.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
                  Mi Panel Personal
                </span>
                {currentWorkerObj.isPayroll ? (
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    ⭐ Nómina Fija
                  </span>
                ) : (
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    💶 10,00 €/h
                  </span>
                )}
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit'] mt-0.5 truncate">
                Hola, {currentWorkerObj.name} 👋
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-300">{currentWorkerObj.role}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-amber-300 truncate">
                  <Truck className="w-3 h-3 shrink-0" />
                  <span className="truncate">{currentWorkerObj.truck}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Admin Toggle if Raúl */}
          {(currentWorkerObj.name.toLowerCase() === 'raúl' || currentWorkerObj.name.toLowerCase() === 'raul') && onOpenAdminDashboard && (
            <button
              onClick={onOpenAdminDashboard}
              className="w-full sm:w-auto py-2 px-3.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 border border-amber-400 shrink-0"
            >
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              <span>👑 Panel Admin Completo</span>
            </button>
          )}
        </div>

        {/* 🎯 HERO ACTION CARD: IMMEDIATE TASK (0 SCROLL REQUIRED!) */}
        <div className={`rounded-2xl p-4 sm:p-5 border transition-all ${
          activeShift
            ? 'bg-gradient-to-r from-rose-950/50 via-slate-950 to-rose-950/30 border-rose-500/50 shadow-xl shadow-rose-950/30'
            : immediateTask
            ? 'bg-gradient-to-br from-emerald-950/40 via-slate-950 to-amber-950/30 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
            : 'bg-slate-950/80 border-slate-800'
        }`}>
          {activeShift ? (
            /* ACTIVE SHIFT: Live Clock-Out Button */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-500/20 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                    🔴 ESTÁS EN TURNO ACTIVO
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400">Tiempo transcurrido:</span>
                  <span className="text-base font-extrabold font-mono text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
                    {elapsedTimeFormatted}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Tarea en curso:</span>
                <p className="text-sm sm:text-base font-extrabold text-white font-['Outfit'] mt-0.5">
                  📌 {activeShift.taskName || 'Turno Operativo General'}
                </p>
              </div>

              <button
                onClick={() => { setPrefilledTask(null); setIsClockModalOpen(true); }}
                className="w-full py-3.5 px-6 rounded-xl text-sm font-extrabold bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center space-x-2 transition-all shadow-xl shadow-rose-600/30 active:scale-95"
              >
                <Square className="w-4 h-4" />
                <span>🔴 Fichar Salida / Finalizar Tarea</span>
              </button>
            </div>
          ) : immediateTask ? (
            /* PENDING TASK: 1-Click Clock-In Button */
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <Target className="w-4 h-4 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    TU PRIMERA TAREA ASIGNADA
                  </span>
                </div>
                <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  📅 {immediateTask.dayTitle}
                </span>
              </div>

              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-white font-['Outfit'] leading-snug">
                  {immediateTask.taskName}
                </h2>
                {immediateTask.timeFrame && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 mt-1">
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3 h-3" />
                      {immediateTask.timeFrame}
                    </span>
                    {immediateTask.location && (
                      <span className="text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-rose-400" />
                        {immediateTask.location}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* PRIMARY 1-CLICK CLOCK-IN BUTTON */}
              <button
                onClick={() => {
                  setPrefilledTask(immediateTask.taskName);
                  setIsClockModalOpen(true);
                }}
                className="w-full py-3.5 px-6 rounded-xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 flex items-center justify-center space-x-2 transition-all shadow-xl shadow-emerald-500/25 active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>⏱️ Fichar Esta Tarea Ahora (1 Toque)</span>
              </button>

              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <button
                  onClick={() => {
                    setPrefilledTask(null);
                    setIsClockModalOpen(true);
                  }}
                  className="hover:text-amber-400 text-slate-400 underline decoration-slate-700 hover:decoration-amber-400 transition-colors"
                >
                  ➕ O fichar otra tarea / fichaje libre
                </button>
                <span className="text-[10px] text-slate-500">Queda bloqueado tras enviar</span>
              </div>
            </div>
          ) : (
            /* NO PENDING TASKS */
            <div className="space-y-2.5 text-center py-2">
              <span className="text-sm font-bold text-slate-200 block">
                🎉 ¡Estás al día! No tienes más tareas pendientes hoy.
              </span>
              <button
                onClick={() => { setPrefilledTask(null); setIsClockModalOpen(true); }}
                className="w-full sm:w-auto py-2.5 px-5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md"
              >
                🟢 Fichar Tarea Extra o Libre
              </button>
            </div>
          )}
        </div>

        {/* 2. Compact 2x2 on Mobile / 4-Col on Desktop Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className={`p-2.5 rounded-xl border ${
            activeShift ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}>
            <span className="text-[9px] font-bold block uppercase tracking-wider">Estado</span>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${activeShift ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span className="font-bold text-xs text-white truncate font-['Outfit']">
                {activeShift ? 'En Turno' : 'Fuera de Turno'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Turno Actual</span>
            <p className="text-xs sm:text-sm font-extrabold text-emerald-400 font-mono mt-0.5 truncate">
              {activeShift ? elapsedTimeFormatted : '0h 00m'}
            </p>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider font-mono">Horas Semana</span>
            <p className="text-xs sm:text-sm font-extrabold text-amber-400 font-mono mt-0.5">
              {totalCompletedHours.toFixed(1)}h
            </p>
          </div>

          <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
            <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Tareas Semana</span>
            <p className="text-xs sm:text-sm font-extrabold text-blue-400 mt-0.5 font-['Outfit']">
              {totalAssignedTasks} <span className="text-[10px] text-slate-400 font-normal">({completedTasksCount} ok)</span>
            </p>
          </div>
        </div>

        {/* Lock Security Notice - Slim 1-line */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Fichajes bloqueados tras registro (solo Socias/Admin editan).</span>
          </span>
          <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded">
            🔒 INMUTABLE
          </span>
        </div>
      </div>

      {/* 📅 SECTION: 7-DAY VISUAL WEEKLY TIMELINE BAR */}
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
              📅 Calendario
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
              <span>🕸️ Grafo</span>
            </button>
          </div>
        </div>

        {viewModeType === 'graph' ? (
          <TaskFlowGraphView activeWeekData={activeWeekData} onToggleTask={onToggleTask} />
        ) : (
          <>
            {/* HORIZONTAL SCROLLABLE DAY PILLS BAR (SLIDER INSTEAD OF 400PX STACK) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-1 px-1">
              <button
                onClick={() => setSelectedDayKey('all')}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 border ${
                  selectedDayKey === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                📋 Toda la Semana ({totalAssignedTasks})
              </button>

              {daysWithActivities.map((day) => {
                const isSelected = selectedDayKey === day.key;
                const hasActivity = day.totalCount > 0;
                const isSaturday = day.key === 'sabado';

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
          </>
        )}

        {/* DETAILED TASKS & WEDDINGS BREAKDOWN ACCORDING TO SELECTED DAY */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-amber-400" />
              <span>
                {selectedDayKey === 'all' 
                  ? 'Desglose Completo de tu Cuadrante Semanal' 
                  : `Tareas Asignadas para ${weekDays.find(d => d.key === selectedDayKey)?.title}`}
              </span>
            </h3>
            <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              {displayedDays.filter(d => d.totalCount > 0).length} días con asignación directa
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {displayedDays.map((dayGroup) => {
              if (dayGroup.totalCount === 0 && selectedDayKey === 'all') return null;

              return (
                <div 
                  key={dayGroup.key} 
                  className={`bg-slate-950 border p-5 rounded-2xl space-y-4 transition-all ${
                    dayGroup.weddings.length > 0
                      ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/20'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-extrabold text-amber-300 text-base font-['Outfit']">
                        📅 {dayGroup.title}
                      </h4>
                      <span className="text-[11px] text-slate-400 block mt-0.5">{dayGroup.badge}</span>
                    </div>

                    <span className="text-[10px] bg-slate-900 text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-800">
                      {dayGroup.totalCount} {dayGroup.totalCount === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>

                  {/* Tasks List */}
                  {dayGroup.tasks.length > 0 && (
                    <ul className="space-y-2 text-xs text-slate-200">
                      {dayGroup.tasks.map((task, idx) => {
                        const taskText = typeof task === 'object' ? task.text : task;
                        const isCompleted = typeof task === 'object' ? task.completed : false;
                        const taskLabel = typeof task === 'object' && task.timeFrame
                          ? `${taskText} (${task.timeFrame})`
                          : taskText;

                        return (
                          <li 
                            key={idx}
                            className={`p-3 rounded-xl border transition-all flex flex-col space-y-2.5 ${
                              isCompleted
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-slate-900 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div 
                              className="flex items-start space-x-2.5 cursor-pointer hover:text-white"
                              onClick={() => {
                                if (onToggleTask) {
                                  const dayObj = activeWeekData.schedule?.[dayGroup.key];
                                  if (dayObj && dayObj.tasks) {
                                    const taskIdx = dayObj.tasks.findIndex(t => (typeof t === 'object' ? t.text : t) === taskText);
                                    if (taskIdx !== -1) onToggleTask(dayGroup.key, taskIdx);
                                  }
                                }
                              }}
                            >
                              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
                              <span className={`leading-relaxed font-medium ${isCompleted ? 'line-through' : ''}`}>
                                {taskText}
                              </span>
                            </div>

                            {/* Rich Metadata (Time & Location) */}
                            {typeof task === 'object' && (task.timeFrame || task.mapsUrl || task.location) && (
                              <div className="flex flex-wrap items-center gap-2 pl-6 mt-1">
                                {task.timeFrame && (
                                  <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {task.timeFrame}
                                  </span>
                                )}
                                {task.mapsUrl ? (
                                  <a 
                                    href={task.mapsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                                  >
                                    <MapPin className="w-3 h-3" />
                                    {task.location || 'Abrir en Maps'}
                                  </a>
                                ) : task.location ? (
                                  <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {task.location}
                                  </span>
                                ) : null}
                              </div>
                            )}

                            {/* ⏱️ Per-Task Clock-In Button */}
                            {!isCompleted && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPrefilledTask(taskLabel);
                                  setIsClockModalOpen(true);
                                }}
                                className="mt-1 ml-6 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95"
                              >
                                <Play className="w-3 h-3" />
                                <span>⏱️ Fichar Esta Tarea</span>
                              </button>
                            )}
                          </li>
                        );
                      })}
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
                        <div key={idx} className="bg-slate-900 p-3.5 rounded-xl border border-amber-500/30 space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-extrabold text-white block">🏔️ {w.location}</span>
                            {w.timeFrame && (
                              <span className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {w.timeFrame}
                              </span>
                            )}
                          </div>
                          
                          <span className="text-amber-400 font-semibold text-xs block">{w.truck}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed pb-1">{w.details}</p>
                          
                          {w.mapsUrl && (
                            <a 
                              href={w.mapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-2 py-1 rounded items-center gap-1 mt-1 transition-colors"
                            >
                              <MapPin className="w-3 h-3" />
                              Ruta a {w.location}
                            </a>
                          )}

                          <button
                            onClick={() => {
                              setPrefilledTask(`Boda: ${w.location} (${w.truck})`);
                              setIsClockModalOpen(true);
                            }}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>⏱️ Fichar Boda Sábado</span>
                          </button>
                        </div>
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
      </div>

      {/* SECTION: REGISTERED CLOCK ENTRIES HISTORY */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span>Mi Historial de Fichajes Registrados</span>
          </h3>
          <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            {myEntries.length} fichajes enviados
          </span>
        </div>

        {myEntries.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/60 rounded-2xl border border-slate-800">
            <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400">Aún no has registrado ningún fichaje de entrada o salida esta semana.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Fecha & Hora</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Tarea / Concepto</th>
                  <th className="py-3 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {myEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-200">
                      <div className="font-bold text-white">{entry.timeFormatted}</div>
                      <div className="text-[10px] text-slate-500">{entry.dateFormatted}</div>
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
                        <span>🔒 Registrado</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clock In Modal for worker */}
      <ClockInModal
        isOpen={isClockModalOpen}
        onClose={() => { setIsClockModalOpen(false); setPrefilledTask(null); }}
        workersList={workersList}
        initialWorkerName={currentWorkerObj.name}
        initialTaskName={prefilledTask}
        onClockEntryCreated={onClockEntryCreated}
      />

    </div>
  );
}

