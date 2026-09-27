import React from 'react';
import { AlertTriangle, Minus, PenLine, Plus } from 'lucide-react';

// Lo que cambiaría en la semana si se aplica lo que propone Gemini (diffSemana) y lo
// que conviene revisar antes (avisosDeSemana). `diff` es opcional: en una semana
// nueva no hay nada con qué comparar y solo se enseñan los avisos.
export default function CambiosPropuestos({ diff = null, avisos = [] }) {
  const total = diff ? diff.resumen.nuevas + diff.resumen.quitadas + diff.resumen.cambiadas : 0;

  return (
    <div className="space-y-3">
      {avisos.length > 0 && (
        <div role="alert" className="space-y-1 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> Revísalo antes de aplicar
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {avisos.map((a, i) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}

      {diff && (
        total === 0 ? (
          <p className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">No cambia ninguna tarea respecto a la semana actual.</p>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 text-xs">
            <p className="flex flex-wrap gap-x-3 gap-y-1 border-b border-slate-800 px-3 py-2 font-semibold">
              <span className="text-emerald-400">+{diff.resumen.nuevas} nuevas</span>
              <span className="text-rose-400">−{diff.resumen.quitadas} quitadas</span>
              <span className="text-amber-300">{diff.resumen.cambiadas} cambiadas</span>
            </p>
            <div className="max-h-64 divide-y divide-slate-800/70 overflow-y-auto">
              {diff.porDia.map(d => (
                <details key={d.dia} className="group px-3 py-2" open={diff.porDia.length <= 2}>
                  <summary className="cursor-pointer select-none font-semibold text-slate-200">
                    {d.etiqueta}
                    <span className="ml-2 font-normal text-slate-500">
                      {[d.nuevas.length && `+${d.nuevas.length}`, d.quitadas.length && `−${d.quitadas.length}`, d.cambiadas.length && `~${d.cambiadas.length}`].filter(Boolean).join(' · ')}
                    </span>
                  </summary>
                  <ul className="mt-1.5 space-y-1 text-slate-300">
                    {d.nuevas.map((t, i) => (
                      <li key={`n${i}`} className="flex gap-1.5"><Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Nueva" />{t}</li>
                    ))}
                    {d.quitadas.map((t, i) => (
                      <li key={`q${i}`} className="flex gap-1.5 text-slate-400 line-through decoration-rose-500/60"><Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" aria-label="Quitada" />{t}</li>
                    ))}
                    {d.cambiadas.map((c, i) => (
                      <li key={`c${i}`} className="flex gap-1.5">
                        <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Cambiada" />
                        <span>{c.texto} <span className="text-slate-500">— {c.cambios.join('; ')}</span></span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}
