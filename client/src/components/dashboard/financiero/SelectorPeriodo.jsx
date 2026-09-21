import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MODOS_PERIODO } from '../../../data/periodosFinancieros';

// Selector de periodo: Semana / Mes / Año / Todo (con un indicador que se
// desliza de uno a otro) y, debajo o al lado según el ancho, las flechas para
// ir al periodo anterior o siguiente.
export default function SelectorPeriodo({ modo, etiqueta, onCambiarModo, onAnterior, onSiguiente, siguienteDeshabilitado }) {
  const indice = Math.max(0, MODOS_PERIODO.findIndex(m => m.id === modo));
  const conFlechas = modo !== 'todo';

  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div role="group" aria-label="Periodo" className="relative grid grid-cols-4 rounded-xl border border-slate-800 bg-slate-950 p-1 sm:w-80">
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-amber-500 shadow-md shadow-amber-500/20 transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${indice * 100}%)` }}
        />
        {MODOS_PERIODO.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onCambiarModo(m.id)}
            aria-pressed={modo === m.id}
            className={`relative z-10 rounded-lg px-2 py-2 text-xs font-bold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
              modo === m.id ? 'text-slate-950' : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end min-w-0">
        {conFlechas && (
          <button
            type="button"
            onClick={onAnterior}
            aria-label="Periodo anterior"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <p
          key={etiqueta}
          aria-live="polite"
          className="min-w-0 flex-1 sm:flex-none px-1 text-center text-sm font-bold text-slate-100 animate-aparecer motion-reduce:animate-none"
        >
          {etiqueta}
        </p>
        {conFlechas && (
          <button
            type="button"
            onClick={onSiguiente}
            disabled={siguienteDeshabilitado}
            aria-label="Periodo siguiente"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-800 bg-slate-950 text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:opacity-30 disabled:hover:border-slate-800 disabled:hover:text-slate-300"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
