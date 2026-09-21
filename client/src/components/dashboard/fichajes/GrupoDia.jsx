import React from 'react';
import { ChevronDown } from 'lucide-react';
import Desplegable from '../../ui/Desplegable';
import { formatearHoras } from '../../../data/formatoFinanciero';
import { formatWeekdayDayMonth } from '../../../utils/dateUtils';

const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Cabecera de un día del historial y su lista plegable. `etiqueta` marca hoy o
// ayer; las horas son las de los turnos que EMPIEZAN ese día.
export default function GrupoDia({ grupo, etiqueta = null, abierto, onAlternar, retraso = 0, children }) {
  const titulo = grupo.fecha
    ? capitalizar(formatWeekdayDayMonth(grupo.fecha))
    : 'Sin fecha';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg animate-aparecer motion-reduce:animate-none" style={{ animationDelay: `${retraso}ms` }}>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-slate-800/40 sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-sm font-extrabold text-amber-300">{titulo}</span>
          {etiqueta && <span className="rounded-full bg-amber-500 px-2 py-px text-[10px] font-extrabold uppercase text-slate-950">{etiqueta}</span>}
          <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-px text-[10px] font-semibold text-slate-400">
            {grupo.entradas.length} {grupo.entradas.length === 1 ? 'fichaje' : 'fichajes'}
          </span>
          {grupo.turnos > 0 && (
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-px text-[10px] font-semibold tabular-nums text-emerald-300">
              {formatearHoras(grupo.horas)} en {grupo.turnos} {grupo.turnos === 1 ? 'turno' : 'turnos'}
            </span>
          )}
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${abierto ? 'rotate-180 text-amber-400' : ''}`} />
      </button>
      <Desplegable abierto={abierto}>
        <div className="border-t border-slate-800">{children}</div>
      </Desplegable>
    </section>
  );
}
