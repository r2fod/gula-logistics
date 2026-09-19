import React from 'react';
import { DollarSign, Users, Clock, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';

export default function FinancialSummaryTab({
  totalExtraExpense,
  totalPayrollValuation,
  totalExtraHours,
  eventsList,
  balancesList
}) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase">Presupuesto Extras a Pagar</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-amber-400 mt-2 font-['Outfit'] font-mono">
            {totalExtraExpense.toFixed(2)} €
          </p>
          <p className="text-xs text-slate-500 mt-1">Extras a 10,00 € / hora trabajada</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase">Valoración Control Nóminas</span>
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-3xl font-extrabold text-indigo-400 mt-2 font-['Outfit'] font-mono">
            {totalPayrollValuation.toFixed(2)} €
          </p>
          <p className="text-xs text-slate-500 mt-1">Irene + Raúl (Valoración interna a 14,00 €/h)</p>
        </div>

        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-semibold uppercase">Horas Registradas</span>
            <Clock className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-['Outfit'] font-mono">
            {parseFloat(totalExtraHours.toFixed(2))} h
          </p>
          <p className="text-xs text-slate-500 mt-1">Acumulado de jornadas en fichaje</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Columna Izquierda: Tablas */}
        <div className="space-y-8">
          {/* Tabla Eventos */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[450px]">
            <div className="bg-[#1e3a8a]/50 px-6 py-4 border-b border-slate-800 flex items-center space-x-2 shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h4 className="font-extrabold text-white text-base tracking-wider uppercase">
                DASHBOARDS GULA
              </h4>
            </div>
            <div className="overflow-y-auto no-scrollbar flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e3a8a] text-white sticky top-0 z-10 shadow-md">
                  <tr>
                    <th className="px-6 py-3 font-bold uppercase">Evento</th>
                    <th className="px-6 py-3 font-bold uppercase text-right">Horas</th>
                    <th className="px-6 py-3 font-bold uppercase text-right">Coste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {eventsList.map((evt, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-slate-800/20" : "bg-transparent"}>
                    <td className="px-6 py-3 font-bold text-slate-200">{evt.eventName}</td>
                    <td className="px-6 py-3 text-right text-slate-300">{parseFloat(evt.totalHours.toFixed(2))}</td>
                    <td className="px-6 py-3 text-right font-bold text-amber-400">{evt.totalCost.toFixed(2)} €</td>
                  </tr>
                ))}
                {eventsList.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No hay eventos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Tabla Personal */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col max-h-[450px]">
            <div className="overflow-y-auto no-scrollbar flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#1e3a8a] text-white sticky top-0 z-10 shadow-md">
                  <tr>
                    <th className="px-6 py-3 font-bold uppercase">Personal</th>
                    <th className="px-6 py-3 font-bold uppercase text-right">Horas</th>
                    <th className="px-6 py-3 font-bold uppercase text-right">Coste</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {balancesList.filter(w => w.totalHours > 0).map((w, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-slate-800/20" : "bg-transparent"}>
                    <td className="px-6 py-3 font-bold text-slate-200 flex items-center space-x-2">
                      <span>{w.avatar}</span>
                      <span>{w.name}</span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-300">{parseFloat(w.totalHours.toFixed(2))}</td>
                    <td className="px-6 py-3 text-right font-bold text-amber-400">{w.totalCost.toFixed(2)} €</td>
                  </tr>
                ))}
                {balancesList.filter(w => w.totalHours > 0).length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No hay horas de personal.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Gráficas */}
        <div className="space-y-8 sticky top-6 self-start">
          {/* Gráfica Barras */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
            <h4 className="font-bold text-slate-400 text-center text-lg mb-6">Coste por Evento</h4>
            <div className="h-64 w-full">
              {eventsList.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventsList} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                    <XAxis 
                      dataKey="eventName" 
                      tick={{ fill: '#94a3b8', fontSize: 9 }}
                      tickLine={false}
                      axisLine={false}
                      angle={-35}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis 
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `${value}€`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#334155', opacity: 0.2 }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', padding: '12px' }}
                      itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                      formatter={(value) => [`${value.toFixed(2)}€`, 'Coste']}
                    />
                    <Bar dataKey="totalCost" radius={[4, 4, 0, 0]}>
                      {eventsList.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#3b82f6" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-600 text-sm">
                  Sin datos suficientes
                </div>
              )}
            </div>
          </div>

          {/* Gráfica Donut */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
            <h4 className="font-bold text-slate-400 text-center text-lg mb-2">Distribución de Horas</h4>
            <div className="h-64 w-full relative">
              {balancesList.filter(w => w.totalHours > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={balancesList.filter(w => w.totalHours > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="totalHours"
                      nameKey="name"
                      label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
                      labelLine={false}
                    >
                      {balancesList.filter(w => w.totalHours > 0).map((entry, index) => {
                        const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4', '#f59e0b', '#64748b', '#ec4899'];
                        return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', padding: '12px' }}
                      itemStyle={{ color: '#fbbf24', fontWeight: 'bold' }}
                      formatter={(value) => [`${parseFloat(value.toFixed(2))}h`, 'Horas']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-slate-600 text-sm">
                  Sin datos suficientes
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
