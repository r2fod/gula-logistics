import React, { useState } from 'react';
import { CheckSquare, Clock, Lock, Pin, Play, Plus, Square, Target } from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';
import EnVivo from '../ui/EnVivo';
import LlevasGanado from './LlevasGanado';
import { duracionEnCurso } from '../../data/costeEnVivo';
import { crearFichaje } from '../../data/fichajes';
import { getDayLabel, refDeTareaFichada } from '../../data/taskPlanning';
import { textoDeEspera } from '../../data/agendaTrabajador';

// Texto del botón de empezar la jornada: se elige uno al azar al abrir la vista (no en
// cada render, para que no cambie solo). Todas dicen claramente lo que hace el botón.
const START_JORNADA_LABELS = [
  'INICIAR JORNADA AHORA',
  '¡ARRANCAMOS! INICIAR JORNADA',
  '¡A POR EL DÍA! INICIAR JORNADA',
  '¡VAMOS ALLÁ! INICIAR JORNADA',
  'CAFÉ TOMADO: INICIAR JORNADA',
  '¡A MOVER CAJAS! INICIAR JORNADA',
  '¡A LA CARRETERA! INICIAR JORNADA',
  '¡CON GANAS! INICIAR JORNADA',
];

// La tarjeta grande de fichar de la vista del trabajador (sin scroll): en turno, el
// cronómetro, la tarea en curso y «Fichar salida»; fuera de turno, «¿Listo para empezar
// el día?» con la puerta de los 5 min antes de la primera tarea.
// `onFichar(() => fichaje)` es el envío protegido contra doble toque de WorkerView.
export default function TarjetaFichar({
  turno, esJornada, trabajador, semana, proximaTarea, proximaEsOtroDia, hayTarea,
  puertaCerrada, sinTareasPendientes, inicioPrimeraTarea, ahora, textoPuerta, ocupado,
  onFichar, onDeshacer, onFicharLibre,
}) {
  const { confirm } = useDialog();
  const [startLabel] = useState(() => START_JORNADA_LABELS[Math.floor(Math.random() * START_JORNADA_LABELS.length)]);

  return (
    <div className={`mt-3 rounded-2xl p-3 sm:p-5 border transition-all ${
      turno
        ? 'bg-gradient-to-r from-rose-950/60 via-slate-950 to-rose-950/40 border-rose-500/50 shadow-xl shadow-rose-950/30'
        : hayTarea
        ? 'bg-gradient-to-br from-emerald-950/40 via-slate-950 to-amber-950/30 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
        : 'bg-slate-950/80 border-slate-800'
    }`}>
      {turno ? (
        <div className="space-y-3">
          {/* Cada pieza en una línea: si no caben juntas (móvil estrecho o letra grande), el
              cronómetro baja entero en vez de partirse ("3h 48m" / "02s"). */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rose-500/20 pb-2">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-rose-500 animate-ping motion-reduce:animate-none"></span>
              <span className="text-[11px] font-black uppercase tracking-wider text-rose-400">
                EN TURNO
              </span>
            </div>
            <span className="whitespace-nowrap tabular-nums text-sm sm:text-base font-extrabold font-mono text-emerald-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" /><EnVivo>{(momento) => duracionEnCurso(turno, momento)}</EnVivo>
            </span>
          </div>

          <div>
            <p className="text-sm sm:text-base font-extrabold text-white font-outfit">
              <Pin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{esJornada ? 'Jornada iniciada' : (turno.taskName || 'Turno Operativo General')}
            </p>
          </div>

          {!trabajador.isPayroll && <LlevasGanado turno={turno} trabajador={trabajador} />}

          {esJornada && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mt-2">
              <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2 mb-2">
                <div className="flex items-center space-x-1.5 text-emerald-400">
                  <Target className="w-4 h-4" />
                  <span className="text-[11px] font-black uppercase tracking-wider">{proximaEsOtroDia ? 'PRÓXIMA TAREA' : 'TAREA EN CURSO'}</span>
                </div>
              </div>

              {proximaTarea ? (
                <>
                  <p className="text-xs font-bold text-white mb-1">{proximaTarea.taskName}</p>
                  {(proximaTarea.timeFrame || proximaEsOtroDia) && <p className="text-[11px] text-slate-400 mb-3">{[proximaEsOtroDia && getDayLabel(semana, proximaTarea.dayKey), proximaTarea.timeFrame].filter(Boolean).join(' · ')}</p>}
                  {/* Una tarea de un día que no ha llegado no se marca (se espera a ese día). */}
                  <button
                    type="button"
                    onClick={() => {
                      if (proximaEsOtroDia) return;
                      const tRef = proximaTarea.dayKey && proximaTarea.taskIndex != null
                        ? { dayKey: proximaTarea.dayKey, taskIndex: proximaTarea.taskIndex }
                        : null;
                      onFichar(() => crearFichaje({
                        trabajador,
                        tipo: 'fichaje',
                        taskName: String(proximaTarea.taskName).trim(),
                        note: '',
                        taskRef: refDeTareaFichada(semana, tRef)
                      }));
                    }}
                    disabled={proximaEsOtroDia || ocupado}
                    className={`w-full py-2.5 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
                      proximaEsOtroDia
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 active:scale-95'
                    }`}
                  >
                    {proximaEsOtroDia ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Esperando día...</span>
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Marcar como completada</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center py-2">
                  <span className="text-xs font-bold text-slate-400 block">
                    🎉 ¡Estás al día! No tienes tareas pendientes hoy.
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={ocupado}
            onClick={() => onFichar(() => crearFichaje({ trabajador, tipo: 'salida', note: '' }))}
            className={`w-full py-3.5 px-3 rounded-xl text-xs min-[360px]:text-sm font-extrabold flex items-center justify-center space-x-2 transition-all shadow-xl active:scale-95 ${
              ocupado ? 'bg-rose-900/50 text-rose-500 cursor-not-allowed shadow-none' : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            <Square className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{esJornada ? 'FINALIZAR JORNADA' : 'Fichar salida'}</span>
          </button>

          {/* Deshacer: solo durante los primeros 15 min */}
          {((ahora || new Date()) - new Date(turno.timestamp) < 15 * 60 * 1000) && (
            <button
              type="button"
              onClick={async () => {
                if (await confirm('¿Seguro que quieres anular este fichaje de entrada? Hazlo solo si le diste por error.', { type: 'warning' })) {
                  onDeshacer(turno.id);
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 flex items-center justify-center transition-colors border border-slate-700"
            >
              Deshacer Entrada (Me he equivocado)
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
            <div className="flex items-center space-x-1.5 text-emerald-400">
              <Clock className="w-4 h-4 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider">
                FUERA DE TURNO
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white font-outfit leading-snug">
              ¿Listo para empezar el día?
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Inicia tu jornada general. Luego podrás ir marcando las tareas que termines.
            </p>
          </div>

          {/* La puerta mira la fecha REAL de la primera tarea, no solo la hora de hoy: una
              tarea de un día futuro no deja iniciar jornada antes de tiempo. */}
          <button
            type="button"
            disabled={puertaCerrada || ocupado}
            onClick={() => onFichar(() => crearFichaje({
              trabajador,
              tipo: 'entrada',
              taskName: 'JORNADA',
              note: 'Inicio de Jornada',
              taskRef: null
            }))}
            className={`w-full py-3.5 px-3 sm:px-4 rounded-xl text-[13px] min-[360px]:text-sm font-extrabold flex items-center justify-center gap-2 transition-all ${
              !puertaCerrada && !ocupado
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 shadow-xl shadow-emerald-500/25 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {!puertaCerrada ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>{startLabel}</span>
              </>
            ) : sinTareasPendientes ? (
              <>
                <Lock className="w-4 h-4 shrink-0" />
                <span className="text-center">Sin tareas pendientes</span>
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 shrink-0 hidden min-[360px]:block" aria-hidden="true" />
                {/* Si no cabe (320 px, letra grande) baja de línea entre palabras en vez de
                    cortarse; el tiempo no se parte. */}
                <span className="text-center">Espera <span className="whitespace-nowrap">{inicioPrimeraTarea ? textoDeEspera(inicioPrimeraTarea, ahora) : '0 min'}</span> para fichar</span>
              </>
            )}
          </button>
          {puertaCerrada && (
            <p className="text-[11px] text-slate-400">
              {sinTareasPendientes ? 'Si te han llamado para algo que no está en tu planning, usa «O fichar otra tarea libre».' : `${textoPuerta} (5 min antes de tu primera tarea).`}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-3 mt-3 border-t border-slate-800 text-[11px] text-slate-400">
        <button
          type="button"
          onClick={onFicharLibre}
          className="whitespace-nowrap py-2 hover:text-amber-400 text-slate-300 underline decoration-slate-700 hover:decoration-amber-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />O fichar otra tarea libre
        </button>
        <span className="whitespace-nowrap text-[11px] text-slate-500">
          <Lock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Registro seguro
        </span>
      </div>
    </div>
  );
}
