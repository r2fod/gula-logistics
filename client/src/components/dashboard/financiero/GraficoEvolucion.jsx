import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatearEuros, formatearHoras } from '../../../data/formatoFinanciero';

// Etiqueta emergente de una barra: el tramo, su coste y sus horas.
function Globo({ active, payload }) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-xl">
      <p className="text-[11px] font-semibold text-slate-400">{t.etiqueta}</p>
      <p className="text-sm font-extrabold text-amber-400 tabular-nums">{formatearEuros(t.coste)}</p>
      <p className="text-[11px] text-slate-400 tabular-nums">{formatearHoras(t.horas)}</p>
    </div>
  );
}

// Coste por tramo del periodo (día, semana o mes). Barras con degradado que
// suben al aparecer (la animación es la propia de Recharts).
export default function GraficoEvolucion({ serie }) {
  return (
    <div className="flex-1 min-h-[13rem] sm:min-h-[15rem] w-full px-1 sm:px-3 pt-4 pb-2" role="img" aria-label="Coste de personal por tramo del periodo">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="degradadoCoste" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
              <stop offset="100%" stopColor="#d97706" stopOpacity={0.75} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#1e293b" strokeDasharray="3 3" />
          <XAxis dataKey="etiqueta" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={6} />
          <YAxis width={56} tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} €`} allowDecimals={false} />
          <Tooltip cursor={{ fill: '#334155', opacity: 0.25 }} content={<Globo />} />
          <Bar dataKey="coste" fill="url(#degradadoCoste)" radius={[6, 6, 0, 0]} maxBarSize={44} animationDuration={900} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
