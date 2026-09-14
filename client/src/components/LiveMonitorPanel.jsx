import React, { useState, useEffect } from 'react';
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
  Radio, 
  CheckCircle2, 
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react';

export default function LiveMonitorPanel({ 
  workersList = [], 
  clockEntries = [], 
  activeSchedule = {}, 
  isFullScreen = false,
  onToggleFullScreen 
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'trucks' | 'base'

  // Live timer for elapsed shift duration
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Map active clock entries per worker
  const activeShifts = {};
  clockEntries.forEach(entry => {
    if (entry.type === 'entrada') {
      activeShifts[entry.workerName] = entry;
    } else if (entry.type === 'salida') {
      delete activeShifts[entry.workerName];
    }
  });

  // Schedule lookup helper for current day tasks
  const getAssignedTaskForWorker = (workerName) => {
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const todayIndex = currentTime.getDay();
    const dayKey = days[todayIndex] || 'martes';

    const daySchedule = activeSchedule[dayKey] || activeSchedule['martes'] || {};
    const tasks = daySchedule.tasks || [];

    // Find task matching worker name
    const matched = tasks.find(t => {
      const text = typeof t === 'object' ? t.text : t;
      return text.toLowerCase().includes(workerName.toLowerCase());
    });

    if (matched) {
      return typeof matched === 'object' ? matched.text : matched;
    }

    // Default fallback task by role
    if (workerName === 'Gonzalo' || workerName === 'Ricardo') return '🚚 Ruta Flota / Albacar & Fincas';
    if (workerName === 'Jaime') return '🚛 Camión 3 / Guiado María y Joaquín';
    if (workerName === 'Johan') return '🚚 Descarga Fincas / Backup Camión 2';
    if (workerName === 'Irene') return '📦 Almacén Base / Checklist Pedidos & Frío';
    if (workerName === 'Jeferson') return '📦 Pre-carga Almacén & Soporte Logística';
    if (workerName === 'Kerly' || workerName === 'Jose') return '🧹 Higienización & Vajilla Eventos';
    if (workerName === 'Raúl') return '📋 Supervisión Flota & Estiba Camiones';

    return '📋 Asignado en Operativa Activa';
  };

  const getWorkerLocation = (workerName) => {
    if (workerName === 'Gonzalo' || workerName === 'Ricardo' || workerName === 'Jaime' || workerName === 'Johan') {
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

    return {
      ...w,
      isClockedIn,
      clockEntry,
      elapsedTimeFormatted,
      currentTask: getAssignedTaskForWorker(w.name),
      location: getWorkerLocation(w.name)
    };
  });

  const activeCount = workerStatuses.filter(w => w.isClockedIn).length;

  const filteredWorkers = workerStatuses.filter(w => {
    if (filterStatus === 'active') return w.isClockedIn;
    if (filterStatus === 'trucks') return w.role.toLowerCase().includes('conductor') || w.role.toLowerCase().includes('flota');
    if (filterStatus === 'base') return w.role.toLowerCase().includes('base') || w.role.toLowerCase().includes('preparación');
    return true;
  });

  return (
    <div className={`space-y-6 transition-all ${isFullScreen ? 'p-6 bg-slate-950 text-white min-h-screen' : ''}`}>
      
      {/* Live Monitor Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3.5">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping"></span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-extrabold font-['Outfit'] text-white">
                  Monitor de Actividad en Tiempo Real
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>EN VIVO</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Seguimiento en directo de estado de jornada, tarea asignada y ubicación por trabajador.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 text-center">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Fichados Ahora</span>
              <span className="text-xl font-extrabold text-emerald-400 font-['Outfit']">
                {activeCount} / {workersList.length}
              </span>
            </div>

            <div className="bg-slate-950/80 px-4 py-2 rounded-2xl border border-slate-800 text-center font-mono">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Hora Oficial</span>
              <span className="text-sm font-bold text-amber-400">
                {currentTime.toLocaleTimeString()}
              </span>
            </div>

            {onToggleFullScreen && (
              <button
                onClick={onToggleFullScreen}
                className="py-2.5 px-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all shadow-md active:scale-95"
                title={isFullScreen ? "Salir de Pantalla Completa" : "Ver Pantalla Completa"}
              >
                {isFullScreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-amber-400" />}
                <span className="hidden sm:inline">{isFullScreen ? 'Normal' : 'Pantalla Completa'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center space-x-2 mt-5 pt-4 border-t border-slate-800/80 overflow-x-auto">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === 'all' ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Todos el Equipo ({workersList.length})
          </button>

          <button
            onClick={() => setFilterStatus('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === 'active' ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🟢 Activos en Turno ({activeCount})
          </button>

          <button
            onClick={() => setFilterStatus('trucks')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === 'trucks' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            🚚 Conductores Flota
          </button>

          <button
            onClick={() => setFilterStatus('base')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              filterStatus === 'base' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            📦 Base & Preparación
          </button>
        </div>
      </div>

      {/* Workers Real-Time Live Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredWorkers.map((worker) => (
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
                  <div>
                    <h4 className="font-extrabold text-white text-base font-['Outfit']">{worker.name}</h4>
                    <p className="text-[11px] text-slate-400">{worker.role}</p>
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

              {/* Live Ticker if Clocked In */}
              {worker.isClockedIn && (
                <div className="mt-4 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-emerald-400 animate-spin-slow" />
                    <span className="text-xs font-semibold text-emerald-300">Tiempo en turno:</span>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-emerald-400">
                    {worker.elapsedTimeFormatted}
                  </span>
                </div>
              )}

              {/* Current Task Box */}
              <div className="mt-4 space-y-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Actividad / Tarea Asignada
                </span>
                <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-medium">
                  {worker.currentTask}
                </div>
              </div>
            </div>

            {/* Location Badge */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center space-x-1 text-slate-300 font-medium">
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

          </div>
        ))}
      </div>
    </div>
  );
}
