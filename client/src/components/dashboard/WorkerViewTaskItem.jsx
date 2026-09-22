import React from 'react';
import { CheckCircle2, MapPin, Play } from 'lucide-react';
import TaskTextWithEvent from '../TaskTextWithEvent';

// Componente para avisos de tareas bloqueadas
function AvisoBloqueado({ children, className = '' }) {
  return (
    <span className={`inline-block px-2 py-1 rounded bg-slate-800/80 text-[10px] text-slate-400 font-medium ${className}`}>
      🔒 {children}
    </span>
  );
}

export default function WorkerViewTaskItem({ 
  task, 
  dayKey, 
  isCompleted, 
  isDayInFuture, 
  jornadaGateClosed, 
  gateText,
  onToggleTask,
  toStorageDayKey,
  resolveRealTaskIndex,
  onClockIn
}) {
  const taskText = typeof task === 'object' ? task.text : task;
  const timeFrame = typeof task === 'object' ? task.timeFrame : null;
  const taskLabel = timeFrame ? `${taskText} (${timeFrame})` : taskText;

  const handleToggle = () => {
    if (onToggleTask) {
      const storageDayKey = toStorageDayKey(dayKey);
      const taskIdx = resolveRealTaskIndex(storageDayKey, taskText);
      if (taskIdx !== null) onToggleTask(storageDayKey, taskIdx);
    }
  };

  const handleClockIn = (e) => {
    e.stopPropagation();
    const storageDayKey = toStorageDayKey(dayKey);
    const realTaskIndex = resolveRealTaskIndex(storageDayKey, taskText);
    onClockIn(taskLabel, realTaskIndex !== null ? { dayKey: storageDayKey, taskIndex: realTaskIndex } : null);
  };

  return (
    <li 
      className={`p-3 rounded-xl border transition-all flex flex-col space-y-2 ${
        isCompleted
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-slate-900 border-slate-800 text-slate-200'
      }`}
    >
      <div 
        className="flex items-start space-x-2.5 cursor-pointer hover:text-white"
        onClick={handleToggle}
      >
        <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span className={`font-medium ${isCompleted ? 'line-through opacity-70' : ''}`}>
          <TaskTextWithEvent text={taskText} event={typeof task === 'object' ? task.event : undefined} />{timeFrame ? ` (${timeFrame})` : ''}
        </span>
        {typeof task === 'object' && task.targetDay && (
          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md whitespace-nowrap shrink-0 border ${
            task.targetDay === 'Domingo'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
          }`}>
            {task.targetDay.toUpperCase()}
          </span>
        )}
      </div>
      
      {/* Location Badge if available */}
      {typeof task === 'object' && (task.mapsUrl || task.location) && (
        <div className="ml-6 flex">
          {task.mapsUrl ? (
            <a 
              href={task.mapsUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors"
            >
              <MapPin className="w-3 h-3" />
              {task.location || 'Abrir en Maps'}
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg">
              <MapPin className="w-3 h-3" />
              {task.location}
            </span>
          )}
        </div>
      )}

      {!isCompleted && (
        isDayInFuture ? (
          <AvisoBloqueado className="mt-1 ml-6 self-start flex">Aún no ha llegado este día</AvisoBloqueado>
        ) : jornadaGateClosed ? (
          <AvisoBloqueado className="mt-1 ml-6 self-start flex">{gateText}</AvisoBloqueado>
        ) : (
          <button
            onClick={handleClockIn}
            className="mt-1 ml-6 self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95"
          >
            <Play className="w-3 h-3" />
            <span>Fichar Esta Tarea</span>
          </button>
        )
      )}
    </li>
  );
}
