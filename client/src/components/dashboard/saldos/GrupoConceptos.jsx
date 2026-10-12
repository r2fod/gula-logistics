import React, { useState } from 'react';
import { CalendarDays, Check, Trash2, X } from 'lucide-react';
import { Input } from '../../ui/Campo';
import { aIso } from '../../../data/fechasSemana';
import { formatearEuros, formatearEurosConSigno } from '../../../data/formatoFinanciero';
import { formatDayMonthShort } from '../../../utils/dateUtils';

// Un grupo del desglose de una ficha de Saldos: los turnos fichados (se suman solos
// desde los fichajes) o lo apuntado a mano. Antes iban mezclados en una sola lista y
// no se veía qué parte del saldo salía de cada sitio.
// `onBorrar(item, indice)` solo si se puede borrar (admin); `accion`, un pie opcional.
// `fechaDe(item)`: el día de cada concepto (Date, o null si no tiene) para enseñarlo
// bajo su texto; `undefined` si no hace falta (su texto ya lo dice). Con
// `onFechar(item, indice, 'AAAA-MM-DD')` (admin) ese día se puede poner o corregir.
export default function GrupoConceptos({ titulo, ayuda = null, items = [], total = 0, vacio, fichado = false, onBorrar = null, borrando = false, tituloBorrar, accion = null, fechaDe = null, onFechar = null }) {
  const [fechando, setFechando] = useState(null); // { idx, valor } del concepto al que se le pone fecha

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {titulo} <span className="font-normal normal-case text-slate-500">· {items.length}</span>
        </span>
        <span className={`whitespace-nowrap font-mono text-xs font-bold ${total > 0 ? 'text-emerald-400' : total < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
          {formatearEurosConSigno(total)}
        </span>
      </div>
      {ayuda && <p className="text-[11px] text-slate-500">{ayuda}</p>}
      {items.length === 0 ? (
        <p className="text-[11px] italic text-slate-500">{vacio}</p>
      ) : (
        <ul className={`space-y-1.5 pr-1 ${items.length > 5 ? 'max-h-64 overflow-y-auto custom-scrollbar' : ''}`}>
          {items.map((item, idx) => {
            const fecha = fechaDe ? fechaDe(item) : undefined;
            const dia = fecha ? formatDayMonthShort(fecha) : null;
            return (
              <li
                key={idx}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                  item.amount < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                    : fichado ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'
                      : 'bg-slate-800/80 border-slate-700 text-slate-200'
                }`}
              >
                <span className="min-w-0 flex-1 pr-2">
                  <span className="block break-words font-medium">{item.concept}</span>
                  {fecha !== undefined && (onFechar ? (
                    <button
                      type="button"
                      onClick={() => setFechando({ idx, valor: fecha ? aIso(fecha) : '' })}
                      aria-label={`${dia ? `Cambiar el día (${dia})` : 'Poner el día'} de ${item.concept}`}
                      className="-my-1 inline-flex items-center gap-1 py-1 text-[11px] opacity-75 underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                    >
                      <CalendarDays className="h-3 w-3" aria-hidden="true" /> {dia || 'Poner fecha'}
                    </button>
                  ) : (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] opacity-75">
                      <CalendarDays className="h-3 w-3" aria-hidden="true" /> {dia || 'Sin fecha'}
                    </span>
                  ))}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`whitespace-nowrap font-mono font-bold ${item.amount > 0 ? 'text-emerald-400' : item.amount < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {item.amount > 0 ? formatearEurosConSigno(item.amount) : formatearEuros(item.amount)}
                  </span>
                  {onBorrar && (
                    <button
                      type="button"
                      onClick={() => { setFechando(null); onBorrar(item, idx); }}
                      disabled={borrando}
                      aria-label={`${tituloBorrar}: ${item.concept}`}
                      title={tituloBorrar}
                      className="-m-2 rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </span>
                {fechando?.idx === idx && (
                  <span className="flex basis-full items-center gap-1.5">
                    <Input
                      type="date"
                      aria-label={`Día de ${item.concept}`}
                      value={fechando.valor}
                      max={aIso(new Date())}
                      onChange={(e) => setFechando({ idx, valor: e.target.value })}
                      tamano="2xs" fondo="medio" borde="marcado"
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => { onFechar(item, idx, fechando.valor); setFechando(null); }}
                      disabled={!fechando.valor || borrando}
                      aria-label="Guardar el día"
                      title="Guardar el día"
                      className="rounded-lg bg-amber-500 p-2 text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFechando(null)}
                      aria-label="No cambiar el día"
                      title="No cambiar el día"
                      className="rounded-lg bg-slate-800 p-2 text-slate-300 transition-colors hover:bg-slate-700"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {accion}
    </div>
  );
}
