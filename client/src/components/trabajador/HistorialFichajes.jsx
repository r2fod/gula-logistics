import React from 'react';
import { Clock, Lock, Pin } from 'lucide-react';
import EstadoVacio from '../ui/EstadoVacio';
import InsigniaTipo from '../dashboard/fichajes/InsigniaTipo';
import { fechaDeFichaje, horaDeFichaje } from '../../data/fichajes';
import { formatearHoras } from '../../data/formatoFinanciero';

// «Mis fichajes» en la vista del trabajador: lo que ha fichado esta semana, en tarjetas
// en el móvil y en tabla desde tablet. Solo puede AÑADIR uno olvidado (onAnadir); editar
// o borrar es cosa del admin. `duracionDeSalida`: Map id de salida → horas de su turno.
export default function HistorialFichajes({ fichajes = [], duracionDeSalida = new Map(), onAnadir }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <h3 className="text-lg sm:text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
          <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>Mi Historial de Fichajes Registrados</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 hidden sm:inline-block">
            {fichajes.length} fichajes enviados
          </span>
          <button
            type="button"
            onClick={onAnadir}
            className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] flex items-center space-x-1 shadow-md shadow-amber-500/20 transition-all active:scale-95"
          >
            <span>+ Añadir Manual</span>
          </button>
        </div>
      </div>

      {fichajes.length === 0 ? (
        <EstadoVacio icono={Clock} titulo="Aún no has registrado ningún fichaje de entrada o salida esta semana." className="py-8 bg-slate-950/60" />
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <div className="block sm:hidden space-y-2.5">
            {fichajes.map((entry) => (
              <div key={entry.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-white">
                    {horaDeFichaje(entry)} <span className="text-[11px] text-slate-400 font-normal">({fechaDeFichaje(entry)})</span>
                  </span>
                  <InsigniaTipo tipo={entry.type} />
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  <Pin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{entry.taskName || entry.note || 'Turno General'}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
                  <span className="text-[11px] text-slate-400">
                    {duracionDeSalida.has(entry.id) ? `Duración: ${formatearHoras(duracionDeSalida.get(entry.id))}` : 'Turno registrado'}
                  </span>
                  <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Bloqueado
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Desde tablet: tabla */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Fecha & Hora</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Tarea / Concepto</th>
                  <th className="py-3 px-3">Estado</th>
                  <th className="py-3 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {fichajes.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-200">
                      <div className="font-bold text-white">{horaDeFichaje(entry)}</div>
                      <div className="text-[11px] text-slate-500">{fechaDeFichaje(entry)}</div>
                    </td>
                    <td className="py-3 px-3"><InsigniaTipo tipo={entry.type} /></td>
                    <td className="py-3 px-3 text-slate-300 font-medium">{entry.taskName || entry.note || '—'}</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-flex items-center space-x-1">
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Guardado</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-[11px] font-bold text-amber-300">Solo Admin</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
