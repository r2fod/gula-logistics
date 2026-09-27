import React, { useState } from 'react';
import { ChevronDown, NotebookPen } from 'lucide-react';
import Seccion from '../../ui/Seccion';
import Desplegable from '../../ui/Desplegable';
import { TIPOS_CONCEPTO } from '../../../data/conceptosSaldos';
import { formatearEuros, formatearEurosConSigno } from '../../../data/formatoFinanciero';

// Lo apuntado a mano en Saldos & Acuerdos dentro del periodo (conceptosDelPeriodo):
// turnos que no se ficharon, transporte, bolsa y ajustes. No cambia el "Coste de
// personal" (que sale de los fichajes): se enseña aparte y, al pie, lo que suma
// junto con los extras fichados — lo que de verdad se paga.
export default function ConceptosAMano({ conceptos, extrasFichados, todo, retraso = 0 }) {
  const [abierto, setAbierto] = useState(null);
  const tipos = Object.entries(conceptos.porTipo);

  const pie = (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="font-bold uppercase tracking-wider text-slate-400">Extras fichados + a mano</span>
      <span className="text-sm font-extrabold tabular-nums text-amber-400">{formatearEuros(extrasFichados + conceptos.total)}</span>
    </div>
  );

  return (
    <Seccion titulo="Apuntado a mano en Saldos & Acuerdos" subtitulo="Lo que no sale de los fichajes: turnos a mano, transporte y ajustes" icono={NotebookPen} color="text-rose-300" retraso={retraso} pie={tipos.length ? pie : null}>
      {tipos.length === 0 ? (
        <p className="px-3.5 sm:px-5 py-4 text-xs text-slate-500">Nada apuntado a mano en este periodo.</p>
      ) : (
        <ul className="flex-1">
          {tipos.map(([tipo, { importe, conceptos: n }]) => {
            const items = conceptos.items.filter(i => i.tipo === tipo);
            const esAbierto = abierto === tipo;
            return (
              <li key={tipo} className="border-b border-slate-800/70 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setAbierto(esAbierto ? null : tipo)}
                  aria-expanded={esAbierto}
                  className="group flex w-full items-center justify-between gap-3 px-3.5 sm:px-5 py-3 text-left transition-colors hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-100">{TIPOS_CONCEPTO[tipo]}</span>
                    <span className="text-[11px] text-slate-500">{n} {n === 1 ? 'concepto' : 'conceptos'}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`text-sm font-bold tabular-nums ${importe < 0 ? 'text-rose-400' : 'text-amber-400'}`}>{formatearEurosConSigno(importe)}</span>
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${esAbierto ? 'rotate-180 text-amber-400' : ''}`} />
                  </span>
                </button>
                <Desplegable abierto={esAbierto}>
                  <ul className="mx-3.5 sm:mx-5 mb-3 space-y-1 rounded-xl border border-slate-800/70 bg-slate-950/60 p-2.5">
                    {items.map((it, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 text-slate-300"><b className="text-slate-200">{it.persona}</b> · <span className="break-words">{it.concepto}</span></span>
                        <span className={`shrink-0 tabular-nums ${it.importe < 0 ? 'text-rose-400' : 'text-slate-300'}`}>{formatearEurosConSigno(it.importe)}</span>
                      </li>
                    ))}
                  </ul>
                </Desplegable>
              </li>
            );
          })}
        </ul>
      )}
      {!todo && conceptos.sinFechaFuera > 0 && (
        <p className="border-t border-slate-800 px-3.5 sm:px-5 py-2.5 text-[11px] text-slate-500">
          {conceptos.sinFechaFuera} {conceptos.sinFechaFuera === 1 ? 'concepto no lleva' : 'conceptos no llevan'} fecha (horas de bolsa, roturas, adelantos…): solo se suman en «Todo».
        </p>
      )}
    </Seccion>
  );
}
