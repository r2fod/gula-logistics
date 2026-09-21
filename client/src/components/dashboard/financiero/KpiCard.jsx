import React from 'react';
import { useCountUp } from '../../../hooks/useAnimaciones';

// Un color por tarjeta; las clases van completas para que Tailwind las detecte.
const COLORES = {
  amber: { valor: 'text-amber-400', icono: 'text-amber-400 bg-amber-500/10 border-amber-500/20', brillo: 'bg-amber-500/10' },
  indigo: { valor: 'text-indigo-300', icono: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20', brillo: 'bg-indigo-500/10' },
  emerald: { valor: 'text-emerald-400', icono: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', brillo: 'bg-emerald-500/10' },
  sky: { valor: 'text-sky-300', icono: 'text-sky-300 bg-sky-500/10 border-sky-500/20', brillo: 'bg-sky-500/10' },
};

// Tarjeta de cifra: el número corre hasta su valor al aparecer y al cambiar de
// periodo. `formato` convierte el número (animado) en texto.
export default function KpiCard({ titulo, valor, formato, icono: Icono, color = 'amber', pie = null, retraso = 0, className = '' }) {
  const c = COLORES[color] || COLORES.amber;
  const mostrado = useCountUp(valor);

  return (
    <div
      className={`relative overflow-hidden min-w-0 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-lg animate-aparecer motion-reduce:animate-none transition-[border-color,transform] duration-300 hover:border-slate-700 sm:hover:-translate-y-0.5 ${className}`}
      style={{ animationDelay: `${retraso}ms` }}
    >
      <div aria-hidden="true" className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl ${c.brillo}`} />
      <div className="relative flex items-start justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 leading-snug">{titulo}</h4>
        {Icono && (
          <span className={`shrink-0 grid place-items-center h-8 w-8 rounded-xl border ${c.icono}`}>
            <Icono className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={`relative mt-1 sm:mt-3 truncate text-xl sm:text-2xl xl:text-3xl font-extrabold tabular-nums tracking-tight ${c.valor}`}>
        {formato(mostrado)}
      </p>
      {pie && <div className="relative mt-1.5 text-[11px] sm:text-xs text-slate-500 leading-snug">{pie}</div>}
    </div>
  );
}
