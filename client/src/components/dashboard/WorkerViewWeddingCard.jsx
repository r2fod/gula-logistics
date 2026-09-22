import React from 'react';
import { CheckCircle2, MapPin, Clock, Play } from 'lucide-react';

// Componente para avisos de tareas bloqueadas
function AvisoBloqueado({ children, className = '' }) {
  return (
    <span className={`inline-block px-2 py-1 rounded bg-slate-800/80 text-[10px] text-slate-400 font-medium ${className}`}>
      🔒 {children}
    </span>
  );
}

export default function WorkerViewWeddingCard({ 
  wedding, 
  isCompleted, 
  isDayInFuture, 
  jornadaGateClosed, 
  gateText,
  onToggleTask,
  resolveRealTaskIndex,
  getWeddingTaskName,
  onClockIn
}) {
  const taskName = getWeddingTaskName(wedding);

  const handleToggle = () => {
    if (onToggleTask) {
      const realIdx = resolveRealTaskIndex('sabado', taskName);
      if (realIdx !== null) onToggleTask('sabado', realIdx);
    }
  };

  const handleClockIn = (e) => {
    e.stopPropagation();
    const realTaskIndex = resolveRealTaskIndex('sabado', taskName);
    onClockIn(taskName, realTaskIndex !== null ? { dayKey: 'sabado', taskIndex: realTaskIndex } : null);
  };

  return (
    <div className={`p-3 sm:p-3.5 rounded-xl border space-y-1 transition-all ${
      isCompleted
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        : 'bg-slate-900 border-amber-500/30'
    }`}>
      <div 
        className="flex justify-between items-start cursor-pointer hover:text-white"
        onClick={handleToggle}
      >
        <div className="flex items-start space-x-2.5">
          <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isCompleted ? 'text-emerald-400' : 'text-slate-500'}`} />
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className={`font-black text-sm ${isCompleted ? 'line-through opacity-70' : 'text-white'}`}>
                <MapPin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{wedding.location}
              </span>
              {wedding.timeFrame && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {wedding.timeFrame}
                </span>
              )}
            </div>
            <p className="text-amber-400 font-bold text-xs mt-1">{wedding.truck}</p>
            {wedding.note && <p className={`text-[11px] mt-1 ${isCompleted ? 'text-emerald-300/70' : 'text-slate-400'}`}>{wedding.note}</p>}
          </div>
        </div>
      </div>
      
      {wedding.mapsUrl && (
        <div className="ml-6 pt-1">
          <a 
            href={wedding.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-2.5 py-1 rounded-lg transition-colors"
          >
            <MapPin className="w-3 h-3" />
            Ruta a {wedding.location}
          </a>
        </div>
      )}

      {!isCompleted && (
        <div className="ml-6 pt-1">
          {isDayInFuture ? (
            <AvisoBloqueado>Aún no ha llegado este día</AvisoBloqueado>
          ) : jornadaGateClosed ? (
            <AvisoBloqueado>{gateText}</AvisoBloqueado>
          ) : (
            <button
              onClick={handleClockIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 transition-all active:scale-95 mt-1"
            >
              <Play className="w-3 h-3" />
              <span>Fichar Boda Sábado</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
