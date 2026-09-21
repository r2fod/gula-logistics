import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatearHoras, formatearPorcentaje } from '../../../data/formatoFinanciero';

export const COLORES_PERSONAL = ['#f59e0b', '#38bdf8', '#34d399', '#a78bfa', '#fb7185', '#2dd4bf', '#f472b6', '#94a3b8'];

// Reparto de las horas entre el personal: rosca con el total en el centro y una
// leyenda con nombre, horas y porcentaje (antes solo había porcentajes sueltos,
// sin saber a quién correspondía cada trozo).
export default function DonutHoras({ datos, totalHoras }) {
  return (
    <div className="flex flex-col p-3.5 sm:p-5 md:flex-row md:items-center md:gap-8 lg:flex-col lg:items-stretch lg:gap-0">
      <div className="relative mx-auto h-44 sm:h-52 w-full max-w-[16rem] md:mx-0 md:shrink-0 lg:mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos} dataKey="horas" nameKey="nombre" innerRadius="64%" outerRadius="92%" paddingAngle={datos.length > 1 ? 3 : 0} stroke="none" animationDuration={900}>
              {datos.map((d, i) => <Cell key={d.nombre} fill={COLORES_PERSONAL[i % COLORES_PERSONAL.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '12px', padding: '8px 12px' }}
              itemStyle={{ color: '#fbbf24', fontWeight: 700 }}
              formatter={(v, nombre) => [formatearHoras(v), nombre]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</p>
            <p className="text-lg sm:text-xl font-extrabold text-slate-100 tabular-nums">{formatearHoras(totalHoras)}</p>
          </div>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 md:mt-0 md:flex-1 lg:mt-4 lg:flex-none lg:grid-cols-1 2xl:grid-cols-2">
        {datos.map((d, i) => (
          <li key={d.nombre} className="flex items-center justify-between gap-2 text-xs min-w-0">
            <span className="flex min-w-0 items-center gap-2 text-slate-300">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORES_PERSONAL[i % COLORES_PERSONAL.length] }} aria-hidden="true" />
              <span className="truncate">{d.nombre}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-400">
              {formatearHoras(d.horas)} <span className="text-slate-600">·</span> {formatearPorcentaje(totalHoras > 0 ? (d.horas / totalHoras) * 100 : 0, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
