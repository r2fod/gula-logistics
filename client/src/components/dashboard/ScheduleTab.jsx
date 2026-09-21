import React, { useState } from 'react';
import { Users, Calendar, Clock, Check, Sparkles } from 'lucide-react';
import { isTaskPast, getDayLabel } from '../../data/taskPlanning';
import TaskTextWithEvent from '../TaskTextWithEvent';

export default function ScheduleTab({ activeWeekData, workersList, onToggleTask, onUpdateWeek }) {
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState(null);

  // Auto-completion logic based on time
  const currentTime = new Date();

  // Dynamic Fleet Tasks Injection
  const trucks = activeWeekData?.trucks || [];
  const dynamicTasksByDay = {
    martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: [], lunes: []
  };

  const normalizeDay = (dayStr) => {
    if (!dayStr) return null;
    const d = dayStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return d;
  };

  trucks.forEach((truck, tIdx) => {
    if (truck.tag === 'ALQUILER') {
      const pDay = normalizeDay(truck.pickupDay);
      if (pDay && dynamicTasksByDay[pDay]) {
        dynamicTasksByDay[pDay].push({
          isDynamic: true, type: 'pickup', truckIndex: tIdx,
          text: `🚚 Recogida: ${truck.name}`,
          timeFrame: truck.pickupTime,
          completed: !!truck.pickupCompleted,
          pdfUrl: truck.pdfUrl
        });
      }
      
      const rDay = normalizeDay(truck.returnDay);
      if (rDay && dynamicTasksByDay[rDay]) {
        dynamicTasksByDay[rDay].push({
          isDynamic: true, type: 'return', truckIndex: tIdx,
          text: `🔙 Devolución: ${truck.name}`,
          timeFrame: truck.returnTime,
          completed: !!truck.returnCompleted,
          pdfUrl: truck.pdfUrl
        });
      }
    }
  });

  const handleDynamicToggle = (task) => {
    if (!onUpdateWeek) return;
    const newTrucks = [...trucks];
    const field = task.type === 'pickup' ? 'pickupCompleted' : 'returnCompleted';
    newTrucks[task.truckIndex] = { ...newTrucks[task.truckIndex], [field]: !newTrucks[task.truckIndex][field] };
    onUpdateWeek(activeWeekData.id, { trucks: newTrucks });
  };

  const renderDynamicTask = (task, idx, dayKey) => {
    // El día de una tarea de flota es explícito (pickupDay/returnDay): en
    // domingo/lunes se fija como targetDay para que no se trate como ambigua.
    const isCompleted = task.completed || isTaskPast(activeWeekData, dayKey, { ...task, targetDay: dayKey }, currentTime);
    
    return (
      <li 
        key={`dyn-${idx}`} 
        onClick={() => handleDynamicToggle(task)}
        className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
          isCompleted 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through opacity-60' 
            : 'bg-amber-500/5 border-amber-500/40 hover:border-amber-400 text-amber-200 shadow-sm shadow-amber-500/5'
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
          <span className={isCompleted ? 'line-through' : 'font-semibold'}>{task.text}</span>
          {task.timeFrame && (
            <span className="ml-2 text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 align-middle whitespace-nowrap border border-amber-500/30">
              <Clock className="w-3 h-3" />
              {task.timeFrame}
            </span>
          )}
          {task.pdfUrl && (
            <a 
              href={task.pdfUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-2 text-[10px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 inline-flex items-center gap-1 align-middle no-underline"
            >
              PDF
            </a>
          )}
        </div>
      </li>
    );
  };

  // Tarea de la lista compartida domingo/lunes. isTaskPast usa el targetDay
  // de la tarea y, si no lo tiene, la evalúa como lunes (no se tacha el
  // domingo una tarea que puede ser del lunes).
  const renderSharedTask = (task, idx) => {
    const taskText = typeof task === 'object' ? task.text : task;
    const timeFrame = typeof task === 'object' ? task.timeFrame : null;
    const manuallyCompleted = typeof task === 'object' ? !!task.completed : false;
    const isCompleted = manuallyCompleted || isTaskPast(activeWeekData, 'domingo', task, currentTime);

    const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
    const matchesFilter = !selectedWorkerFilter || taskAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

    return (
      <div key={idx} className={`p-4 rounded-2xl border leading-relaxed transition-all ${
        isCompleted
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through opacity-60'
          : !matchesFilter 
            ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850 text-slate-500' 
            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
      }`}>
        <span>
          {isCompleted && <Check className="w-4 h-4 inline mr-1 text-emerald-400" />}
          <TaskTextWithEvent text={taskText} />
        </span>
        {timeFrame && (
          <span className="mt-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1 w-fit whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {timeFrame}
          </span>
        )}
      </div>
    );
  };

  const sharedTasks = (activeWeekData?.sundayMonday?.tasks || []).map((task, idx) => ({ task, idx }));
  const targetDayOf = (task) => (typeof task === 'object' && task.targetDay ? task.targetDay.toLowerCase() : null);
  const sharedGroups = [
    {
      key: 'domingo', dynamicKey: 'domingo', title: getDayLabel(activeWeekData, 'domingo', currentTime),
      chip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      tasks: sharedTasks.filter(({ task }) => targetDayOf(task) === 'domingo'),
    },
    {
      key: 'lunes', dynamicKey: 'lunes', title: getDayLabel(activeWeekData, 'lunes', currentTime),
      chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      tasks: sharedTasks.filter(({ task }) => targetDayOf(task) === 'lunes'),
    },
    {
      key: 'sin-dia', title: 'Sin día fijado (domingo o lunes)',
      hint: 'Ábrelas en el editor y elige "Día Específico" para colocarlas.',
      chip: 'bg-slate-800/80 text-slate-300 border-slate-700',
      tasks: sharedTasks.filter(({ task }) => !targetDayOf(task)),
    },
  ].filter(g => g.tasks.length > 0 || (g.dynamicKey && dynamicTasksByDay[g.dynamicKey]?.length > 0));

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
                  const manuallyCompleted = typeof task === 'object' ? !!task.completed : false;
                  
                  const isCompleted = manuallyCompleted || isTaskPast(activeWeekData, key, task, currentTime);
                  
                  const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
                  const matchesFilter = !selectedWorkerFilter || taskAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

                  return (
                    <li 
                      key={idx} 
                      onClick={() => onToggleTask && onToggleTask(key, idx)}
                      className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                        isCompleted 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through opacity-60' 
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
                        <span className={isCompleted ? 'line-through' : ''}><TaskTextWithEvent text={taskText} /></span>
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
                {dynamicTasksByDay[key]?.map((task, idx) => renderDynamicTask(task, idx, key))}
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
              const manuallyCompleted = !!w.completed;
              const isCompleted = manuallyCompleted || isTaskPast(activeWeekData, 'sabado', w, currentTime);
              const wAssigned = w.assigned || [];
              const matchesFilter = !selectedWorkerFilter || wAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

              return (
                <div key={idx} className={`p-5 rounded-2xl border space-y-3 transition-all ${
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 opacity-60'
                    : !matchesFilter 
                      ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850' 
                      : 'bg-slate-950/90 border-slate-800 hover:border-amber-500/30'
                }`}>
                  <div className="flex items-start justify-between">
                    <span className={`font-extrabold block text-sm sm:text-base font-['Outfit'] ${isCompleted ? 'line-through' : !matchesFilter ? 'text-amber-500/50' : 'text-amber-300'}`}>
                      {isCompleted && <Check className="w-4 h-4 inline mr-1 text-emerald-400" />}
                      🏔️ {w.location}
                    </span>
                    {w.timeFrame && (
                      <span className="text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {w.timeFrame}
                      </span>
                    )}
                  </div>
                  <span className={`block font-semibold ${isCompleted ? 'text-emerald-300/70' : !matchesFilter ? 'text-slate-400' : 'text-slate-200'}`}>{w.truck}</span>
                  <p className={`text-xs leading-relaxed ${isCompleted ? 'text-emerald-300/50' : !matchesFilter ? 'text-slate-500' : 'text-slate-400'}`}>{w.details}</p>
                </div>
              );
            })}
          </div>

          {dynamicTasksByDay['sabado']?.length > 0 && (
            <div className="pt-4 mt-2 border-t border-amber-500/20">
              <h4 className="text-xs font-semibold text-amber-400/80 mb-3 uppercase tracking-wider">Logística de Flota</h4>
              <ul className="space-y-2.5 text-xs text-slate-300 grid grid-cols-1 md:grid-cols-2 gap-4">
                {dynamicTasksByDay['sabado'].map((task, idx) => renderDynamicTask(task, idx, 'sabado'))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Sunday / Monday Section */}
      {activeWeekData?.sundayMonday && (
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
            <Calendar className="text-amber-400 w-4 h-4" /> {activeWeekData.sundayMonday.title}
          </h3>

          {/* Una sola lista guarda domingo Y lunes: se separan aquí por el
              "Día Específico" (targetDay) de cada tarea. Las que no lo tienen
              van aparte, para que se vea cuáles faltan por asignar día. */}
          {sharedGroups.map(group => (
            <div key={group.key} className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg border ${group.chip}`}>{group.title}</span>
                {group.hint && <span className="text-[11px] text-slate-500">{group.hint}</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs sm:text-sm text-slate-300">
                {group.tasks.map(({ task, idx }) => renderSharedTask(task, idx))}
                {group.dynamicKey && dynamicTasksByDay[group.dynamicKey]?.map((task, idx) => (
                  <div key={`${group.dynamicKey}-${idx}`} className="p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20 hover:border-amber-400/50 transition-all">
                    <ul className="m-0 p-0 list-none">{renderDynamicTask(task, idx, group.dynamicKey)}</ul>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
