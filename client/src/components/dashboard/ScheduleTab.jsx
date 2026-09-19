import React, { useState } from 'react';
import { Users, Calendar, Clock, Check, Sparkles } from 'lucide-react';

export default function ScheduleTab({ activeWeekData, workersList, onToggleTask }) {
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState(null);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Team Members Grid - Full Widescreen Layout */}
      <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Users className="text-amber-400 w-4 h-4" /> Equipo, Nóminas y Extras ({workersList.length} Miembros)
          </h2>
          {selectedWorkerFilter ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                Filtrando: {selectedWorkerFilter}
              </span>
              <button
                onClick={() => setSelectedWorkerFilter(null)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-xl border border-slate-700 transition-colors"
              >
                Ver Todo el Equipo
              </button>
            </div>
          ) : (
            <span className="text-xs text-slate-400 hidden sm:inline">
              Haz clic en un trabajador para filtrar sus tareas
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3 text-xs">
          {workersList.map((w, idx) => {
            const isSelected = selectedWorkerFilter === w.name;
            return (
              <div 
                key={idx} 
                onClick={() => setSelectedWorkerFilter(isSelected ? null : w.name)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  isSelected 
                    ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 text-white shadow-lg shadow-amber-500/10' 
                    : 'bg-slate-950/80 border-slate-800/80 hover:border-amber-500/40 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-2xl">{w.avatar}</div>
                  {w.isPayroll ? (
                    <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Nómina</span>
                  ) : (
                    <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">10€/h</span>
                  )}
                </div>

                <div className="min-w-0">
                  <span className="font-extrabold text-white truncate text-xs block font-['Outfit']">{w.name}</span>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5">{w.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Schedule Days Grid - 4 Columns Across Widescreen */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {Object.entries(activeWeekData?.schedule || {}).map(([key, day]) => (
          <div key={key} className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
                  <Calendar className="text-amber-400 w-4 h-4" /> {day.title}
                </h3>
                <span className="text-[10px] bg-slate-950 text-amber-300 font-bold px-2.5 py-1 rounded-xl border border-slate-800">
                  {day.badge}
                </span>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                {(day.tasks || []).map((task, idx) => {
                  const taskText = typeof task === 'object' ? task.text : task;
                  const isCompleted = typeof task === 'object' ? !!task.completed : false;
                  const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
                  const matchesFilter = !selectedWorkerFilter || taskAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

                  return (
                    <li 
                      key={idx} 
                      onClick={() => onToggleTask && onToggleTask(key, idx)}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isCompleted 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through' 
                          : matchesFilter && selectedWorkerFilter
                            ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-white font-medium shadow-sm'
                            : !matchesFilter && selectedWorkerFilter
                              ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850 text-slate-400'
                              : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isCompleted ? (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                          </div>
                        ) : (
                          <Clock className="text-amber-400 w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 leading-relaxed">
                        <span className={isCompleted ? 'line-through' : ''}>{taskText}</span>
                        {typeof task === 'object' && task.timeFrame && (
                          <span className="ml-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap">
                            <Clock className="w-3 h-3" />
                            {task.timeFrame}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Saturday Special Section */}
      {activeWeekData?.saturdaySpecial && (
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2 font-['Outfit'] text-white">
              <Sparkles className="text-amber-400 w-5 h-5" /> {activeWeekData.saturdaySpecial.title}
            </h3>
            <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-xl border border-amber-500/30">
              Día Clave
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
            {(activeWeekData.saturdaySpecial.weddings || []).map((w, idx) => {
              const wAssigned = w.assigned || [];
              const matchesFilter = !selectedWorkerFilter || wAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

              return (
                <div key={idx} className={`p-5 rounded-2xl border space-y-3 transition-all ${
                  !matchesFilter 
                    ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850' 
                    : 'bg-slate-950/90 border-slate-800 hover:border-amber-500/30'
                }`}>
                  <div className="flex items-start justify-between">
                    <span className={`font-extrabold block text-sm sm:text-base font-['Outfit'] ${!matchesFilter ? 'text-amber-500/50' : 'text-amber-300'}`}>🏔️ {w.location}</span>
                    {w.timeFrame && (
                      <span className="text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {w.timeFrame}
                      </span>
                    )}
                  </div>
                  <span className={`block font-semibold ${!matchesFilter ? 'text-slate-400' : 'text-slate-200'}`}>{w.truck}</span>
                  <p className={`text-xs leading-relaxed ${!matchesFilter ? 'text-slate-500' : 'text-slate-400'}`}>{w.details}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Sunday / Monday Section */}
      {activeWeekData?.sundayMonday && (
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-3.5">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
            <Calendar className="text-amber-400 w-4 h-4" /> {activeWeekData.sundayMonday.title}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs sm:text-sm text-slate-300">
            {(activeWeekData.sundayMonday.tasks || []).map((task, idx) => {
              const taskText = typeof task === 'object' ? task.text : task;
              const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
              const matchesFilter = !selectedWorkerFilter || taskAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

              return (
                <div key={idx} className={`p-4 rounded-2xl border leading-relaxed transition-all ${
                  !matchesFilter 
                    ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850 text-slate-500' 
                    : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <span>{taskText}</span>
                    {typeof task === 'object' && task.targetDay && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg whitespace-nowrap shrink-0 border ${
                        task.targetDay === 'Domingo' 
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}>
                        {task.targetDay.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {typeof task === 'object' && task.timeFrame && (
                    <span className="mt-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {task.timeFrame}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
