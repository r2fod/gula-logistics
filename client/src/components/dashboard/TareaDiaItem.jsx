import React from 'react';
import { Clock, Check } from 'lucide-react';
import TaskTextWithEvent from '../TaskTextWithEvent';

// Una tarea dentro de la tarjeta de un día. `hecha` la marca con el check y el tachado;
// `filtro` es el nombre de la persona elegida arriba (resalta sus tareas y apaga las
// demás); `alPulsar` la hace pulsable para marcarla o desmarcarla (sin él es solo lectura,
// como las del lunes de la víspera, que se marcan en su semana).
export default function TareaDiaItem({ task, hecha, filtro = null, alPulsar = null }) {
  const texto = typeof task === 'object' ? task.text : task;
  const asignados = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
  const coincide = !filtro || asignados.some(nombre => nombre.toLowerCase() === filtro.toLowerCase());

  return (
    <li
      onClick={alPulsar || undefined}
      className={`flex items-start gap-3 p-3 rounded-2xl border transition-all ${alPulsar ? 'cursor-pointer' : ''} ${
        hecha
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through opacity-60'
          : coincide && filtro
            ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-white font-medium shadow-sm'
            : !coincide && filtro
              ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850 text-slate-400'
              : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-200'
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {hecha ? (
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-emerald-400" />
          </div>
        ) : (
          <Clock className="text-amber-400 w-4 h-4" />
        )}
      </div>
      <div className="flex-1 leading-relaxed">
        <span className={hecha ? 'line-through' : ''}><TaskTextWithEvent text={texto} event={typeof task === 'object' ? task.event : undefined} /></span>
        {typeof task === 'object' && task.timeFrame && (
          <span className="ml-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap">
            <Clock className="w-3 h-3" />
            {task.timeFrame}
          </span>
        )}
        {typeof task === 'object' && task.completedAt && hecha && (
          <span className="ml-2 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap border border-emerald-500/30" title="Hora de finalización real">
            <Check className="w-3 h-3" />
            Fin: {new Date(task.completedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </li>
  );
}
