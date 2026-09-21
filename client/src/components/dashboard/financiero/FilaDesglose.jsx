import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useEntrada } from '../../../hooks/useAnimaciones';
import { formatearEuros, formatearHoras, formatearPorcentaje } from '../../../data/formatoFinanciero';

// Fila de una lista de desglose (por evento o por trabajador): título, coste y
// horas, una barra con su parte del total que crece al aparecer, y un detalle
// que se despliega al pulsarla (quién trabajó en el evento / en qué eventos
// trabajó la persona).
export default function FilaDesglose({ icono = null, titulo, insignia = null, nota = null, horas, coste, porcentaje, detalle = [], retraso = 0 }) {
  const [abierta, setAbierta] = useState(false);
  const listo = useEntrada();
  const anchura = listo ? Math.max(0, Math.min(100, porcentaje)) : 0;
  const hayDetalle = detalle.length > 0;

  return (
    <li className="border-b border-slate-800/70 last:border-b-0 animate-aparecer motion-reduce:animate-none" style={{ animationDelay: `${retraso}ms` }}>
      <button
        type="button"
        onClick={() => hayDetalle && setAbierta(a => !a)}
        aria-expanded={hayDetalle ? abierta : undefined}
        className={`group w-full text-left px-3.5 sm:px-5 py-3 transition-colors hover:bg-slate-800/40 focus:outline-none focus-visible:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60 ${hayDetalle ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-2">
            {icono && <span className="text-base leading-5 shrink-0" aria-hidden="true">{icono}</span>}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-slate-100 break-words">{titulo}</span>
                {insignia && (
                  <span className="rounded-full border border-slate-700 bg-slate-800/70 px-1.5 py-px text-[10px] font-bold text-slate-400 whitespace-nowrap">{insignia}</span>
                )}
              </div>
              {nota && <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{nota}</p>}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-amber-400 tabular-nums">{formatearEuros(coste)}</p>
            <p className="text-[11px] text-slate-400 tabular-nums">{formatearHoras(horas)}</p>
          </div>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{ width: `${anchura}%` }}
            />
          </div>
          <span className="w-12 text-right text-[11px] tabular-nums text-slate-500">{formatearPorcentaje(porcentaje)}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${hayDetalle ? '' : 'invisible'} ${abierta ? 'rotate-180 text-amber-400' : ''}`}
          />
        </div>
      </button>

      {hayDetalle && (
        <div className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} aria-hidden={!abierta}>
          <div className="overflow-hidden">
            <ul className="mx-3.5 sm:mx-5 mb-3 space-y-1 rounded-xl bg-slate-950/60 p-2.5 border border-slate-800/70">
              {detalle.map(d => (
                <li key={d.nombre} className="flex items-center justify-between gap-3 text-xs">
                  <span className="min-w-0 flex items-center gap-1.5 text-slate-300">
                    {d.icono && <span aria-hidden="true">{d.icono}</span>}
                    <span className="truncate">{d.nombre}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-400">
                    {formatearHoras(d.horas)} <span className="text-slate-600">·</span> <span className="font-semibold text-slate-200">{formatearEuros(d.coste)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
