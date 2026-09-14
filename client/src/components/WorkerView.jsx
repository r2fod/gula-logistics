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
  DollarSign
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

  // Extract tasks assigned specifically to this worker
  const scheduleDays = activeWeekData.schedule || {};
  const myTasksByDay = [];

  Object.entries(scheduleDays).forEach(([dayKey, dayObj]) => {
    const tasks = dayObj.tasks || [];
    const matched = tasks.filter(t => {
      const text = typeof t === 'object' ? t.text : t;
      return text.toLowerCase().includes(currentWorkerObj.name.toLowerCase());
    });

    if (matched.length > 0) {
      myTasksByDay.push({
        dayKey,
        dayTitle: dayObj.title,
        badge: dayObj.badge,
        tasks: matched
      });
    }
  });

  // Saturday special check for worker
  const saturdayWeddings = (activeWeekData.saturdaySpecial?.weddings || []).filter(w => 
    w.details.toLowerCase().includes(currentWorkerObj.name.toLowerCase()) ||
    w.truck.toLowerCase().includes(currentWorkerObj.name.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
      
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

        {/* Live Active Shift Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
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
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Tiempo Transcurrido</span>
            <p className="text-xl font-extrabold text-emerald-400 font-mono mt-1">
              {activeShift ? elapsedTimeFormatted : '0h 00m 00s'}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">Calculado en tiempo real</span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider font-mono">Semana Actual</span>
            <p className="text-sm font-bold text-amber-400 mt-1 font-['Outfit']">
              {activeWeekData?.meta?.week || "Semana 3"}
            </p>
            <span className="text-[10px] text-slate-500 block mt-0.5">{activeWeekData?.meta?.dateRange}</span>
          </div>
        </div>

        {/* Lock Security Notice */}
        <div className="bg-slate-950/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <b>Fichajes Seguros:</b> Una vez enviado un fichaje, queda **bloqueado**. La modificación queda reservada a Administración / Socias.
            </span>
          </div>
          <span className="text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded shrink-0">
            🔒 INMUTABLE
          </span>
        </div>
      </div>

      {/* Section 1: My Personal Assigned Tasks */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span>Mis Tareas Asignadas esta Semana</span>
          </h3>
          <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            {myTasksByDay.length} días asignados
          </span>
        </div>

        {myTasksByDay.length === 0 ? (
          <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-bold text-white">No tienes tareas específicas asignadas en la cuadrante semanal.</p>
            <p className="text-xs text-slate-400">Puedes usar el botón "Fichar Entrada" para iniciar cualquier operativa de apoyo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTasksByDay.map((dayGroup) => (
              <div key={dayGroup.dayKey} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-base font-['Outfit'] text-amber-300">
                    📅 {dayGroup.dayTitle}
                  </h4>
                  <span className="text-[10px] bg-slate-900 text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-slate-800">
                    {dayGroup.badge}
                  </span>
                </div>

                <ul className="space-y-2 text-xs text-slate-200">
                  {dayGroup.tasks.map((task, idx) => {
                    const taskText = typeof task === 'object' ? task.text : task;
                    const isCompleted = typeof task === 'object' ? task.completed : false;

                    return (
                      <li 
                        key={idx}
                        onClick={() => {
                          if (onToggleTask) {
                            const dayObj = activeWeekData.schedule[dayGroup.dayKey];
                            const taskIdx = dayObj.tasks.findIndex(t => (typeof t === 'object' ? t.text : t) === taskText);
                            if (taskIdx !== -1) onToggleTask(dayGroup.dayKey, taskIdx);
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
              </div>
            ))}
          </div>
        )}

        {/* Saturday Special Section if assigned */}
        {saturdayWeddings.length > 0 && (
          <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <h4 className="font-extrabold text-amber-300 text-sm flex items-center space-x-2">
              <Truck className="w-4 h-4 text-amber-400" />
              <span>Sábado Clave: Bodas Asignadas</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {saturdayWeddings.map((w, idx) => (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="font-extrabold text-white block">🏔️ {w.location}</span>
                  <span className="text-amber-400 font-semibold block">{w.truck}</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{w.details}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: My Personal Registered Clock Entries History */}
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
