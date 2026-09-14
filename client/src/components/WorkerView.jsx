import React, { useState, useEffect } from 'react';
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
  Filter
} from 'lucide-react';
import ClockInModal from './ClockInModal';

export default function WorkerView({
  workerName,
  workersList = [],
  activeWeekData = {},
  clockEntries = [],
  onToggleTask,
  onClockEntryCreated,
  onToggleGeneralView
}) {
  const [isClockModalOpen, setIsClockModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState('all');

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

    if (['martes', 'miercoles', 'jueves', 'viernes', 'lunes'].includes(dayKey)) {
      const dayObj = activeWeekData.schedule?.[dayKey];
      if (dayObj && dayObj.tasks) {
        tasks = dayObj.tasks.filter(t => {
          const text = typeof t === 'object' ? t.text : t;
          return text.toLowerCase().includes(nameLower);
        });
      }
    } else if (dayKey === 'sabado') {
      const wList = activeWeekData.saturdaySpecial?.weddings || [];
      weddings = wList.filter(w => 
        w.details.toLowerCase().includes(nameLower) ||
        w.truck.toLowerCase().includes(nameLower)
      );
    } else if (dayKey === 'domingo') {
      const sunTasks = activeWeekData.sundayMonday?.tasks || [];
      tasks = sunTasks.filter(t => {
        const text = typeof t === 'object' ? t.text : t;
        return text.toLowerCase().includes(nameLower);
      });
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
    <div className="space-y-6 animate-fadeIn max-w-6xl mx-auto">
      
      {/* Worker Personal Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Profile Details */}
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-950 border border-slate-800 flex items-center justify-center text-4xl shadow-inner shrink-0">
              {currentWorkerObj.avatar}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">
                  Mi Panel Personal
                </span>
                {currentWorkerObj.isPayroll ? (
                  <span className="text-[10px] font-extrabold text-amber-300 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                    ⭐ Nómina Fija
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    💶 Tarifa Extra (10,00 €/h)
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-['Outfit'] mt-1">
                Hola, {currentWorkerObj.name} 👋
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                <span className="font-semibold text-slate-300">{currentWorkerObj.role}</span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-amber-300">
                  <Truck className="w-3.5 h-3.5" />
                  <span>{currentWorkerObj.truck}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Clock-in Action Button */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button
              onClick={() => setIsClockModalOpen(true)}
              className={`w-full md:w-auto py-3.5 px-6 rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all shadow-xl active:scale-95 ${
                activeShift
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{activeShift ? '🔴 Salida / Finalizar Tarea' : '🟢 Fichar Entrada'}</span>
            </button>
          </div>
        </div>

        {/* Live Active Shift & Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80">
          <div className={`p-4 rounded-2xl border ${
            activeShift ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-950/80 border-slate-800 text-slate-400'
          }`}>
            <span className="text-[10px] font-bold block uppercase tracking-wider">Estado de Jornada</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${activeShift ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span className="font-bold text-sm text-white font-['Outfit']">
                {activeShift ? '🟢 EN TURNO Y TRABAJANDO' : '⚪ FUERA DE TURNO'}
              </span>
            </div>
            {activeShift && (
              <p className="text-[11px] text-slate-300 mt-1 truncate">📌 <b>Tarea:</b> {activeShift.taskName}</p>
            )}
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Turno Actual</span>
            <p className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
              {activeShift ? elapsedTimeFormatted : '0h 00m 00s'}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">Tiempo en tiempo real</span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider font-mono">Horas Fichadas</span>
            <p className="text-xl font-extrabold text-amber-400 font-mono mt-1">
              {totalCompletedHours.toFixed(1)}h
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">Total registrado en semana</span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Tareas Asignadas</span>
            <p className="text-xl font-extrabold text-blue-400 mt-1 font-['Outfit']">
              {totalAssignedTasks} <span className="text-xs text-slate-400 font-normal">esta semana</span>
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">{completedTasksCount} completadas</span>
          </div>
        </div>

        {/* Lock Security Notice */}
        <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <b>Fichajes Seguros:</b> Una vez enviado un fichaje, queda <b>bloqueado</b>. La modificación queda reservada a Administración / Socias.
            </span>
          </div>
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
            🔒 INMUTABLE
          </span>
        </div>
      </div>

      {/* 📅 SECTION: 7-DAY VISUAL WEEKLY TIMELINE BAR (VISTA VISUAL DE SU SEMANA) */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
        
        {/* Header & Filter Controller */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Vista Semanal 360°
              </span>
              <span className="text-xs text-slate-400">{activeWeekData?.meta?.dateRange}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit'] mt-1 flex items-center space-x-2">
              <Calendar className="w-6 h-6 text-amber-400" />
              <span>Vista Visual de tu Semana (7 Días)</span>
            </h2>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setSelectedDayKey('all')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                selectedDayKey === 'all'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              📅 Ver Semana Completa
            </button>
          </div>
        </div>

        {/* 7-DAY HORIZONTAL CALENDAR GRID / RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {daysWithActivities.map((day) => {
            const isSelected = selectedDayKey === day.key;
            const hasActivity = day.totalCount > 0;
            const isSaturday = day.key === 'sabado';

            return (
              <div
                key={day.key}
                onClick={() => setSelectedDayKey(isSelected ? 'all' : day.key)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
                  isSelected
                    ? 'bg-gradient-to-b from-amber-500/20 to-slate-950 border-amber-500 ring-2 ring-amber-500/40 text-white shadow-xl scale-[1.02]'
                    : hasActivity
                    ? isSaturday
                      ? 'bg-gradient-to-b from-amber-950/40 to-slate-950 border-amber-500/40 hover:border-amber-400 text-slate-200'
                      : 'bg-slate-950/90 border-slate-800 hover:border-amber-500/40 text-slate-200'
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-100 text-slate-400'
                }`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md font-mono ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}>
                    {day.label} {day.date}
                  </span>

                  {day.weddings.length > 0 && (
                    <span className="text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">
                      👑 BODA
                    </span>
                  )}
                </div>

                {/* Day Title */}
                <div>
                  <h4 className="font-extrabold text-white text-xs font-['Outfit'] truncate">
                    {day.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {day.badge}
                  </p>
                </div>

                {/* Indicator Tag */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  {hasActivity ? (
                    <span className="font-bold text-amber-400 flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>{day.totalCount} {day.totalCount === 1 ? 'actividad' : 'actividades'}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 font-medium">Libre / Backup</span>
                  )}

                  <ChevronRight className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-amber-400' : ''}`} />
                </div>
              </div>
            );
          })}
        </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                        return (
                          <li 
                            key={idx}
                            onClick={() => {
                              if (onToggleTask) {
                                const dayObj = activeWeekData.schedule?.[dayGroup.key];
                                if (dayObj && dayObj.tasks) {
                                  const taskIdx = dayObj.tasks.findIndex(t => (typeof t === 'object' ? t.text : t) === taskText);
                                  if (taskIdx !== -1) onToggleTask(dayGroup.key, taskIdx);
                                }
                              }
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start space-x-2.5 ${
                              isCompleted
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through'
                                : 'bg-slate-900 border-slate-800 hover:border-amber-500/40 text-slate-200'
                            }`}
                          >
                            <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
                            <span className="leading-relaxed font-medium">{taskText}</span>
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
                          <span className="font-extrabold text-white block">🏔️ {w.location}</span>
                          <span className="text-amber-400 font-semibold text-xs block">{w.truck}</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed">{w.details}</p>
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
        onClose={() => setIsClockModalOpen(false)}
        workersList={workersList}
        initialWorkerName={currentWorkerObj.name}
        onClockEntryCreated={onClockEntryCreated}
      />

    </div>
  );
}

