import React from 'react';
import { Award, BarChart3, Calendar, ListTodo, Zap } from 'lucide-react';
import WorkerViewTaskItem from '../dashboard/WorkerViewTaskItem';
import WorkerViewWeddingCard from '../dashboard/WorkerViewWeddingCard';
import { getWeddingTaskName } from '../../data/eventNaming';
import { aClaveGuardada } from '../../data/agendaTrabajador';

const PILDORA = 'px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all shrink-0 border';
const ELEGIDA = 'bg-amber-500 text-slate-950 border-amber-400 shadow-md';

// El cuadrante del trabajador en modo calendario: las píldoras de días (Hoy, Toda la
// semana, MAR…LUN) y la rejilla con las tareas y bodas de los días elegidos.
// `dias` = agenda de la semana (con el lunes); `diasMostrados` = los de la pestaña elegida.
export default function CuadranteDias({
  dias, diasMostrados, diaElegido, hoy, totalTareas, onElegirDia,
  estaHecha, esDiaFuturo, jornadaStarted, puertaCerrada, textoPuerta,
  onToggleTask, resolveRealTaskIndex, onFicharTarea,
}) {
  const conTareas = diasMostrados.filter(d => diaElegido !== 'all' || d.totalCount > 0).length;
  const diasConAsignacion = diasMostrados.filter(d => d.totalCount > 0).length;

  return (
    <>
      {/* Píldoras de días, con scroll horizontal propio */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1 -mx-1 px-1 shrink-0">
        {hoy && (
          <button
            type="button"
            aria-pressed={diaElegido === hoy}
            onClick={() => onElegirDia(hoy)}
            className={`${PILDORA} flex items-center gap-1.5 ${diaElegido === hoy ? ELEGIDA : 'bg-slate-950 text-slate-200 border-slate-800 hover:text-white'}`}
          >
            <span><Zap className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Hoy ({dias.find(d => d.key === hoy)?.label || 'Hoy'})</span>
          </button>
        )}

        <button
          type="button"
          aria-pressed={diaElegido === 'all'}
          onClick={() => onElegirDia('all')}
          className={`${PILDORA} ${diaElegido === 'all' ? ELEGIDA : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'}`}
        >
          <ListTodo className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Toda la Semana ({totalTareas})
        </button>

        {dias.map((day) => {
          const isSelected = diaElegido === day.key;
          const isSaturday = day.key === 'sabado';
          return (
            <button
              key={day.key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onElegirDia(day.key)}
              className={`${PILDORA} flex items-center gap-1.5 ${
                isSelected
                  ? `${ELEGIDA} scale-105`
                  : day.totalCount > 0
                  ? isSaturday
                    ? 'bg-amber-950/30 text-amber-300 border-amber-500/40 hover:border-amber-400'
                    : 'bg-slate-950 text-slate-200 border-slate-800 hover:border-amber-500/40'
                  : 'bg-slate-950/40 text-slate-500 border-slate-800/60'
              }`}
            >
              <span>{day.label} {day.date}</span>
              {day.key === hoy && (
                <span className={`text-[10px] px-1 py-px rounded font-extrabold ${
                  isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-blue-500/20 text-blue-300'
                }`}>
                  HOY
                </span>
              )}
              {day.totalCount > 0 && (
                <span className={`text-[11px] px-1.5 py-px rounded-full font-bold ${
                  isSelected ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-amber-300'
                }`}>
                  {day.totalCount}
                </span>
              )}
              {isSaturday && <span aria-hidden="true">👑</span>}
            </button>
          );
        })}
      </div>

      {/* Tareas y bodas de los días elegidos */}
      <div className="space-y-4 pt-4 border-t border-slate-800 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <h3 className="text-base sm:text-lg font-extrabold text-white font-outfit flex items-center space-x-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
            <span>
              {diaElegido === 'all'
                ? 'Desglose Completo de tu Cuadrante Semanal'
                : `Tareas Asignadas para ${dias.find(d => d.key === diaElegido)?.title}`}
            </span>
          </h3>
          <span className="text-[11px] sm:text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            {diasConAsignacion} {diasConAsignacion === 1 ? 'día' : 'días'} con asignación directa
          </span>
        </div>

        {/* Un solo día: a todo el ancho. Dos días: 2 columnas que llenan la fila. Tres o más: hasta 3 columnas */}
        <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${
          conTareas > 1 ? (conTareas === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 2xl:grid-cols-3') : ''
        } flex-1 items-stretch`}>
          {diasMostrados.map((dayGroup) => {
            if (dayGroup.totalCount === 0 && diaElegido === 'all') return null;

            return (
              <div
                key={dayGroup.key}
                className={`bg-slate-950 border p-4 sm:p-5 rounded-2xl space-y-3 sm:space-y-4 transition-all flex flex-col h-full ${
                  dayGroup.weddings.length > 0
                    ? 'border-amber-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-950/20'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5 shrink-0">
                  <div>
                    <h4 className="whitespace-nowrap font-extrabold text-amber-300 text-sm sm:text-base font-outfit">
                      <Calendar className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{dayGroup.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 block mt-0.5">{dayGroup.badge}</span>
                  </div>

                  <span className="whitespace-nowrap text-[11px] bg-slate-900 text-slate-300 font-bold px-2 py-0.5 rounded-lg border border-slate-800 shrink-0">
                    {dayGroup.totalCount} {dayGroup.totalCount === 1 ? 'tarea' : 'tareas'}
                  </span>
                </div>

                {dayGroup.tasks.length > 0 && (
                  <ul className="space-y-2 text-xs text-slate-200 flex-1">
                    {dayGroup.tasks.map((task, idx) => (
                      <WorkerViewTaskItem
                        key={idx}
                        task={task}
                        dayKey={dayGroup.key}
                        isCompleted={estaHecha(dayGroup.key, task)}
                        isDayInFuture={esDiaFuturo(dayGroup.key)}
                        jornadaStarted={jornadaStarted}
                        jornadaGateClosed={puertaCerrada}
                        gateText={textoPuerta}
                        onToggleTask={onToggleTask}
                        toStorageDayKey={aClaveGuardada}
                        resolveRealTaskIndex={resolveRealTaskIndex}
                        onClockIn={onFicharTarea}
                      />
                    ))}
                  </ul>
                )}

                {dayGroup.weddings.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center space-x-1">
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>Boda Asignada Sábado</span>
                    </span>
                    {dayGroup.weddings.map((w, idx) => (
                      <WorkerViewWeddingCard
                        key={idx}
                        wedding={w}
                        isCompleted={estaHecha('sabado', w)}
                        isDayInFuture={esDiaFuturo('sabado')}
                        jornadaStarted={jornadaStarted}
                        jornadaGateClosed={puertaCerrada}
                        gateText={textoPuerta}
                        onToggleTask={onToggleTask}
                        resolveRealTaskIndex={resolveRealTaskIndex}
                        getWeddingTaskName={getWeddingTaskName}
                        onClockIn={onFicharTarea}
                      />
                    ))}
                  </div>
                )}

                {dayGroup.totalCount === 0 && (
                  <p className="text-xs text-slate-500 italic text-center py-4 flex-1 flex items-center justify-center">
                    Sin tareas directas asignadas para este día. Estás en backup u operativa general de base.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
