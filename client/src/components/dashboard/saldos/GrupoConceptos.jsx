import React from 'react';
import { Trash2 } from 'lucide-react';
import { formatearEuros, formatearEurosConSigno } from '../../../data/formatoFinanciero';

// Un grupo del desglose de una ficha de Saldos: los turnos fichados (se suman solos
// desde los fichajes) o lo apuntado a mano. Antes iban mezclados en una sola lista y
// no se veía qué parte del saldo salía de cada sitio.
// `onBorrar(item, indice)` solo si se puede borrar (admin); `accion`, un pie opcional.
export default function GrupoConceptos({ titulo, ayuda = null, items = [], total = 0, vacio, fichado = false, onBorrar = null, borrando = false, tituloBorrar, accion = null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {titulo} <span className="font-normal normal-case text-slate-500">· {items.length}</span>
        </span>
        <span className={`font-mono text-xs font-bold ${total > 0 ? 'text-emerald-400' : total < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
          {formatearEurosConSigno(total)}
        </span>
      </div>
      {ayuda && <p className="text-[11px] text-slate-500">{ayuda}</p>}
      {items.length === 0 ? (
        <p className="text-[11px] italic text-slate-500">{vacio}</p>
      ) : (
        <ul className={`space-y-1.5 pr-1 ${items.length > 5 ? 'max-h-64 overflow-y-auto custom-scrollbar' : ''}`}>
          {items.map((item, idx) => (
            <li
              key={idx}
              className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                item.amount < 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                  : fichado ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'
                    : 'bg-slate-800/80 border-slate-700 text-slate-200'
              }`}
            >
              <span className="min-w-0 flex-1 break-words pr-2 font-medium">{item.concept}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`font-mono font-bold ${item.amount > 0 ? 'text-emerald-400' : item.amount < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {item.amount > 0 ? formatearEurosConSigno(item.amount) : formatearEuros(item.amount)}
                </span>
                {onBorrar && (
                  <button
                    type="button"
                    onClick={() => onBorrar(item, idx)}
                    disabled={borrando}
                    aria-label={`${tituloBorrar}: ${item.concept}`}
                    title={tituloBorrar}
                    className="text-slate-500 transition-colors hover:text-rose-400 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {accion}
    </div>
  );
}
