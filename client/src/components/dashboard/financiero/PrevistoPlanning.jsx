import React from 'react';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import Seccion from '../../ui/Seccion';
import { formatearEuros, formatearHoras } from '../../../data/formatoFinanciero';

// Horas previstas por el planning de la semana (estimarHorasPlanning) frente a las
// fichadas en esa semana. Es una previsión, no dinero real: no entra en ninguna cifra
// de arriba. Antes era la pestaña "Estimado (Planning)" del informe de Nóminas.
export default function PrevistoPlanning({ estimado, fichadas = {}, retraso = 0 }) {
  const pie = (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-bold uppercase tracking-wider text-slate-400">Previsto en extras</span>
      <span className="whitespace-nowrap tabular-nums text-slate-400">
        {formatearHoras(estimado.horasExtra)} <span className="text-slate-600">·</span> <span className="text-sm font-extrabold text-amber-400">{formatearEuros(estimado.costeExtra)}</span>
      </span>
    </div>
  );

  return (
    <Seccion titulo="Previsto según el planning" subtitulo="Horario de las tareas de esta semana — no son fichajes" icono={CalendarClock} color="text-sky-300" retraso={retraso} pie={estimado.porPersona.length ? pie : null}>
      {estimado.porPersona.length === 0 ? (
        <p className="px-3.5 sm:px-5 py-4 text-xs text-slate-500">Ninguna tarea de esta semana tiene horario completo (HH:MM - HH:MM) con alguien asignado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-xs tabular-nums">
            <thead className="text-slate-400">
              <tr className="border-b border-slate-800">
                <th scope="col" className="px-3.5 sm:px-5 py-2 text-left font-semibold">Persona</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Previsto</th>
                <th scope="col" className="px-2 py-2 text-right font-semibold">Fichado</th>
                <th scope="col" className="px-3.5 sm:px-5 py-2 text-right font-semibold">Coste previsto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {estimado.porPersona.map(p => (
                <tr key={p.nombre} className="text-slate-200">
                  <th scope="row" className="px-3.5 sm:px-5 py-2 text-left font-semibold">
                    {p.nombre}{p.nomina && <span className="ml-1.5 text-[10px] font-bold text-indigo-300">Nómina</span>}
                  </th>
                  <td className="px-2 py-2 text-right">{formatearHoras(p.horas)}</td>
                  <td className="px-2 py-2 text-right text-slate-400">{formatearHoras(fichadas[p.nombre] || 0)}</td>
                  <td className="whitespace-nowrap px-3.5 sm:px-5 py-2 text-right font-bold text-amber-400">{p.nomina ? '—' : formatearEuros(p.coste)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {estimado.sinHorario.length > 0 && (
        <details className="border-t border-slate-800 px-3.5 sm:px-5 py-2.5 text-[11px] text-slate-400">
          <summary className="cursor-pointer select-none">
            <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5 align-[-2px] text-amber-400" aria-hidden="true" />
            {estimado.sinHorario.length} {estimado.sinHorario.length === 1 ? 'tarea' : 'tareas'} con gente asignada pero sin horario completo
          </summary>
          <ul className="mt-1.5 space-y-0.5">
            {estimado.sinHorario.map((t, i) => (
              <li key={i}><span className="text-slate-500">{t.dia}:</span> {t.texto} — <span className="text-slate-300">{t.asignados.join(', ')}</span></li>
            ))}
          </ul>
        </details>
      )}
    </Seccion>
  );
}
