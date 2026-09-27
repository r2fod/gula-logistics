import React from 'react';
import { GraduationCap } from 'lucide-react';
import { formatearMinutos, personasPorTipo, MIN_TAREAS_PATRON, MIN_DESVIO_MIN } from '../../data/aprendizajeFichajes';
import EstadoVacio from '../ui/EstadoVacio';
import { formatearHoras } from '../../data/formatoFinanciero';

// Lo que el asistente ha sacado de los fichajes reales (aprenderDeFichajes), tal
// como le llega a Gemini: se marca qué filas entran en el prompt y por qué no el resto.
export default function AprendizajePanel({ aprendizaje }) {
  const porTipo = aprendizaje?.porTipo || [];
  const quien = personasPorTipo(aprendizaje?.porPersona);
  const medidos = porTipo.reduce((n, t) => n + t.tareas, 0);

  if (!porTipo.length && !Object.keys(quien).length) {
    return <EstadoVacio icono={GraduationCap} titulo="Todavía no hay fichajes que enseñen nada" detalle="Aprende en cuanto se fichen tareas del planning." />;
  }

  const entra = (t) => t.tipo !== 'Otras' && t.tareas >= MIN_TAREAS_PATRON && Math.abs(t.desvioMin) >= MIN_DESVIO_MIN;

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Lo que duran las tareas de verdad</h3>
        <p className="text-xs text-slate-400">
          Tiempo fichado frente al horario del planning, solo en tramos que miden una tarea sola ({medidos} de {aprendizaje.enlazados} enlazados con su tarea):
          quien ficha la primera tarea y no cambia hasta la salida mide todo su día, no esa tarea.
        </p>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[30rem] text-xs tabular-nums">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-semibold">Tipo</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Medidas</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Planificado</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Fichado</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Desvío</th>
                <th scope="col" className="px-3 py-2 text-left font-semibold">A Gemini</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {porTipo.map(t => (
                <tr key={t.tipo} className="text-slate-200">
                  <th scope="row" className="px-3 py-2 text-left font-semibold">{t.tipo}</th>
                  <td className="px-3 py-2 text-right">{t.tareas}</td>
                  <td className="px-3 py-2 text-right">{formatearMinutos(t.planificadoMin)}</td>
                  <td className="px-3 py-2 text-right">{formatearMinutos(t.realMin)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${t.desvioMin > MIN_DESVIO_MIN ? 'text-rose-400' : t.desvioMin < -MIN_DESVIO_MIN ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {t.desvioMin > 0 ? '+' : ''}{formatearMinutos(t.desvioMin)}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {entra(t) ? <span className="text-emerald-400 font-semibold">Sí</span>
                      : t.tipo === 'Otras' ? 'No (sin tipo)'
                      : t.tareas < MIN_TAREAS_PATRON ? `Faltan ${MIN_TAREAS_PATRON - t.tareas} más`
                      : 'No (desvío pequeño)'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {Object.keys(quien).length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-white">Quién suele hacer cada cosa</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(quien).map(([tipo, lista]) => (
              <li key={tipo} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">{tipo}</p>
                <p className="text-xs text-slate-300">{lista.slice(0, 4).map(p => `${p.nombre} (${formatearHoras(p.horas)})`).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-[11px] text-slate-500">Se recalcula solo con cada fichaje; no hace falta guardar nada. Gemini lo recibe al generar o ajustar una semana.</p>
    </div>
  );
}
