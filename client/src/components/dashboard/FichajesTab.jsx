import React, { useMemo, useState } from 'react';
import { ClipboardList, Eye, Plus, Lock, SearchX, TriangleAlert, Timer, UserCheck } from 'lucide-react';
import KpiCard from '../ui/KpiCard';
import BarraFiltros from './fichajes/BarraFiltros';
import GrupoDia from './fichajes/GrupoDia';
import FilaFichaje, { PLANTILLA_FILA } from './fichajes/FilaFichaje';
import { pairShiftsFromEntries, isZombieShift } from '../../data/shiftCalculations';
import { filtrarFichajes, agruparPorDia, turnosPorSalida, contarPorTipo, personasDe, hayFiltros, claveDia } from '../../data/fichajesAgrupados';
import { formatearHoras, formatearNumero } from '../../data/formatoFinanciero';
import { formatTimeShort, formatDuration } from '../../utils/dateUtils';
import { useAhora } from '../../hooks/useAhora';

const PASO_FILA = 25; // ms entre fila y fila al aparecer
const MAX_RETRASO = 400; // las listas largas no se hacen esperar

// Historial de fichajes: resumen, quién está fichado ahora, filtros y los
// fichajes por día (plegables), con cuánto duró y costó cada turno. Los datos
// vienen ya filtrados/agrupados por data/fichajesAgrupados.js.
export default function FichajesTab({
  clockEntries,
  adminUnlocked,
  workersList,
  handleOpenCreateEntry,
  handleOpenEditEntry,
  onDeleteClockEntry
}) {
  const ahora = useAhora();
  const [filtros, setFiltros] = useState({ consulta: '', tipo: 'todos', persona: 'todas' });
  const [manual, setManual] = useState({}); // días que el usuario ha abierto o cerrado a mano

  const cambiar = (parcial) => setFiltros(f => ({ ...f, ...parcial }));
  const filtrando = hayFiltros(filtros);

  const { shifts, activeShifts } = useMemo(() => pairShiftsFromEntries(clockEntries), [clockEntries]);
  const porSalida = useMemo(() => turnosPorSalida(shifts), [shifts]);
  const visibles = useMemo(() => filtrarFichajes(clockEntries, filtros), [clockEntries, filtros]);
  const grupos = useMemo(() => agruparPorDia(visibles, shifts), [visibles, shifts]);
  const cuentas = useMemo(() => contarPorTipo(clockEntries), [clockEntries]);
  const personas = useMemo(() => personasDe(clockEntries), [clockEntries]);

  const enTurno = Object.values(activeShifts);
  const idsEnCurso = new Set(enTurno.map(e => e.id));
  const totalHoras = shifts.reduce((acc, s) => acc + s.durationHours, 0);
  const hoy = claveDia({ timestamp: ahora.toISOString() });
  const ayer = claveDia({ timestamp: new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1, 12).toISOString() });

  // Por defecto solo el día más reciente está abierto; al filtrar se abren todos
  // los que tengan resultados. Lo que el usuario abra o cierre a mano manda.
  const estaAbierto = (g, i) => manual[g.clave] ?? (filtrando || i === 0);
  const todosAbiertos = grupos.length > 0 && grupos.every(estaAbierto);
  const alternarTodos = () => setManual(Object.fromEntries(grupos.map(g => [g.clave, !todosAbiertos])));

  const perfil = (nombre) => workersList.find(w => w.name === nombre);
  const eliminar = (entrada) => {
    if (window.confirm('¿Estás seguro de que quieres borrar este fichaje?') && onDeleteClockEntry) onDeleteClockEntry(entrada.id);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-white sm:text-xl">Historial de fichajes</h3>
              {adminUnlocked ? (
                <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-950">CONTROL ADMINISTRATIVO</span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-blue-300">
                  <Eye className="h-3 w-3" aria-hidden="true" /> SOLO LECTURA
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {adminUnlocked
                ? 'Como administrador puedes editar la fecha y la hora o eliminar fichajes.'
                : 'Fichajes registrados por los trabajadores, protegidos contra edición accidental.'}
            </p>
          </div>
        </div>
        {adminUnlocked ? (
          <button
            type="button"
            onClick={handleOpenCreateEntry}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-400 active:scale-95"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Añadir fichaje manual</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-400">
            <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            <span>Fichajes protegidos</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard titulo="Fichajes" valor={clockEntries.length} formato={(n) => formatearNumero(n, 0)} icono={ClipboardList} color="amber" pie={`${personas.length} ${personas.length === 1 ? 'persona' : 'personas'}`} retraso={60} />
        <KpiCard titulo="Horas fichadas" valor={totalHoras} formato={formatearHoras} icono={Timer} color="emerald" pie={`${shifts.length} ${shifts.length === 1 ? 'turno cerrado' : 'turnos cerrados'}`} retraso={120} />
        <KpiCard titulo="En turno ahora" valor={enTurno.length} formato={(n) => formatearNumero(n, 0)} icono={UserCheck} color="sky" pie={enTurno.length ? 'Con la entrada abierta' : 'Nadie fichado'} retraso={180} className="col-span-2 sm:col-span-1" />
      </div>

      {enTurno.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 sm:px-5 animate-aparecer motion-reduce:animate-none">
          <span className="mr-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">En turno ahora</span>
          {enTurno.map(e => {
            const olvidada = isZombieShift(e, ahora);
            return (
              <span
                key={e.id}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${olvidada ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}
              >
                {olvidada ? (
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                ) : (
                  <span className="relative flex h-2 w-2" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                )}
                <span aria-hidden="true">{perfil(e.workerName)?.avatar || '👤'}</span>
                <span className="font-bold">{e.workerName}</span>
                <span className="tabular-nums opacity-80">desde las {formatTimeShort(e.timestamp)} · {formatDuration(ahora - new Date(e.timestamp))}</span>
                {olvidada && <span className="font-semibold">¿olvidó fichar la salida?</span>}
              </span>
            );
          })}
        </div>
      )}

      {clockEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-4 py-14 text-center">
          <ClipboardList className="mx-auto h-9 w-9 animate-flotar text-slate-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No hay fichajes registrados en el sistema.</p>
          <p className="mt-1 text-xs text-slate-500">Los fichajes de los trabajadores aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <>
          <BarraFiltros
            consulta={filtros.consulta} onConsulta={(consulta) => cambiar({ consulta })}
            tipo={filtros.tipo} onTipo={(tipo) => cambiar({ tipo })}
            persona={filtros.persona} onPersona={(persona) => cambiar({ persona })}
            personas={personas} cuentas={cuentas}
            hayFiltros={filtrando} onLimpiar={() => setFiltros({ consulta: '', tipo: 'todos', persona: 'todas' })}
            todosAbiertos={todosAbiertos} onAlternarTodos={alternarTodos}
          />

          {grupos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 px-4 py-12 text-center">
              <SearchX className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-300">Ningún fichaje coincide con los filtros.</p>
              <button type="button" onClick={() => setFiltros({ consulta: '', tipo: 'todos', persona: 'todas' })} className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/20">
                Quitar filtros
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`hidden gap-x-3 px-5 text-[10px] font-bold uppercase tracking-wider text-slate-500 md:grid ${adminUnlocked ? PLANTILLA_FILA.admin : PLANTILLA_FILA.lectura}`} aria-hidden="true">
                <span>Hora</span><span>Tipo</span><span>Trabajador</span><span>Tarea / concepto</span><span>Tarifa</span>{adminUnlocked && <span className="text-right">Acciones</span>}
              </div>
              {grupos.map((g, i) => (
                <GrupoDia
                  key={g.clave}
                  grupo={g}
                  etiqueta={g.clave === hoy ? 'Hoy' : g.clave === ayer ? 'Ayer' : null}
                  abierto={estaAbierto(g, i)}
                  onAlternar={() => setManual(m => ({ ...m, [g.clave]: !estaAbierto(g, i) }))}
                  retraso={Math.min(i * 60, MAX_RETRASO)}
                >
                  <ul>
                    {g.entradas.map((e, j) => (
                      <FilaFichaje
                        key={e.id}
                        entrada={e}
                        avatar={perfil(e.workerName)?.avatar}
                        turno={e.type === 'salida' ? porSalida[e.id] : null}
                        enCurso={e.type === 'entrada' && idsEnCurso.has(e.id)}
                        admin={adminUnlocked}
                        onEditar={handleOpenEditEntry}
                        onEliminar={eliminar}
                        retraso={Math.min(j * PASO_FILA, MAX_RETRASO)}
                      />
                    ))}
                  </ul>
                </GrupoDia>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
