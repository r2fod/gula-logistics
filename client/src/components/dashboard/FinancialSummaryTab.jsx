import React, { useMemo, useState } from 'react';
import { DollarSign, Users, Clock, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { aggregateShiftsByWorker } from '../../data/shiftCalculations';
import { buildPaxRegistry, buildTaskContextResolver } from '../../data/eventNaming';
import { summarizeByEvent } from '../../data/eventSummary';
import { repartirTiempoSinTarea } from '../../data/repartoPorPlanning';
import { getWeekRange } from '../../data/taskPlanning';
import { MODOS_PERIODO, rangoDePeriodo, moverPeriodo, turnosDelPeriodo, semanasDelPeriodo } from '../../data/periodosFinancieros';

// Con el planning de la semana abierta como punto de partida; si no tiene fechas
// legibles, la semana de hoy.
const anclaInicial = (semana) => getWeekRange(semana)?.start || new Date();

export default function FinancialSummaryTab({ shifts = [], workersList = [], allWeeks = {}, activeWeekData = null }) {
  const [modo, setModo] = useState('semana');
  const [ancla, setAncla] = useState(() => anclaInicial(activeWeekData));

  const rango = useMemo(() => rangoDePeriodo(modo, ancla, allWeeks), [modo, ancla, allWeeks]);
  const turnos = useMemo(() => turnosDelPeriodo(shifts, rango), [shifts, rango]);

  const balancesList = useMemo(() => Object.values(aggregateShiftsByWorker(turnos, workersList)), [turnos, workersList]);
  const totalExtraExpense = balancesList.reduce((acc, w) => acc + (w.isPayroll ? 0 : w.totalCost), 0);
  const totalPayrollValuation = balancesList.reduce((acc, w) => acc + (w.isPayroll ? w.totalCost : 0), 0);
  const totalExtraHours = balancesList.reduce((acc, w) => acc + w.totalHours, 0);

  // Desglose por evento (una tarea de varios eventos reparte su coste entre ellos).
  // El tiempo de jornada sin tarea se reparte según el planning (repartoPorPlanning.js).
  // Los pax son los de las semanas del periodo; el enlace tarea -> evento, el de todas.
  const paxByEvent = useMemo(() => buildPaxRegistry(semanasDelPeriodo(allWeeks, rango, ancla)), [allWeeks, rango, ancla]);
  const resolveEvent = useMemo(() => buildTaskContextResolver(allWeeks), [allWeeks]);
  const eventsList = useMemo(
    () => summarizeByEvent(repartirTiempoSinTarea(turnos, allWeeks, resolveEvent), workersList, paxByEvent, resolveEvent),
    [turnos, allWeeks, workersList, paxByEvent, resolveEvent]
  );
  const horasEstimadas = eventsList.reduce((acc, e) => acc + (e.horasEstimadas || 0), 0);

  const cambiarModo = (nuevo) => {
    // Al pasar de "todo" a un periodo concreto se vuelve a la semana abierta.
    if (modo === 'todo') setAncla(anclaInicial(activeWeekData));
    setModo(nuevo);
  };
  const siguienteEsFuturo = modo !== 'todo' && rangoDePeriodo(modo, moverPeriodo(modo, ancla, 1), allWeeks).desde > new Date();

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Periodo: semana (martes a lunes, como el planning), mes, año o todo */}
      <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Periodo" className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
          {MODOS_PERIODO.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => cambiarModo(m.id)}
              aria-pressed={modo === m.id}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                modo === m.id ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {modo !== 'todo' && (
            <button
              type="button"
              onClick={() => setAncla(moverPeriodo(modo, ancla, -1))}
              aria-label="Periodo anterior"
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="text-sm font-bold text-slate-200 text-center min-w-0 px-2">{rango.etiqueta}</span>
          {modo !== 'todo' && (
            <button
              type="button"
              onClick={() => setAncla(moverPeriodo(modo, ancla, 1))}
              disabled={siguienteEsFuturo}
              aria-label="Periodo siguiente"
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 hover:text-amber-400 transition-colors disabled:opacity-30 disabled:hover:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

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
          <p className="text-xs text-slate-500 mt-1">{turnos.length} {turnos.length === 1 ? 'turno fichado' : 'turnos fichados'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Columna Izquierda: Tablas */}
        <div className="space-y-6 flex flex-col">
          {/* Tabla Eventos */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-indigo-900/40 px-6 py-4 border-b border-slate-800 flex items-center space-x-2 shrink-0">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <h4 className="font-extrabold text-indigo-300 text-sm tracking-wider uppercase">
                Desglose por Evento
              </h4>
            </div>
            {horasEstimadas > 0.05 && (
              <p className="px-6 py-3 text-[11px] text-slate-400 border-b border-slate-800 bg-slate-950/40">
                <span className="font-bold text-amber-400">≈ {parseFloat(horasEstimadas.toFixed(1))} h</span> son jornadas fichadas sin tarea concreta,
                repartidas entre los eventos en los que esa persona estaba asignada según el planning. El total de horas y de dinero no cambia.
              </p>
            )}
            <div className="overflow-y-auto no-scrollbar max-h-[350px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 backdrop-blur text-slate-400 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Evento</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Horas Totales</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Coste Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {eventsList.map((evt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-200">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        <span>{evt.eventName}</span>
                        {evt.pax ? <span className="text-[10px] font-bold text-slate-500">{evt.pax} pax</span> : null}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-300">
                      {parseFloat(evt.totalHours.toFixed(2))} h
                      {evt.horasEstimadas > 0.05 && (
                        <span className="block text-[10px] text-slate-500" title="Horas de jornada sin tarea repartidas según el planning">
                          ≈ {parseFloat(evt.horasEstimadas.toFixed(1))} h por planning
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-amber-400">{evt.totalCost.toFixed(2)} €</td>
                  </tr>
                ))}
                {eventsList.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No hay fichajes en este periodo.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Tabla Personal */}
          <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
            <div className="bg-emerald-900/20 px-6 py-4 border-b border-slate-800 flex items-center space-x-2 shrink-0">
              <Users className="w-5 h-5 text-emerald-400" />
              <h4 className="font-extrabold text-emerald-300 text-sm tracking-wider uppercase">
                Coste por Trabajador
              </h4>
            </div>
            <div className="overflow-y-auto no-scrollbar max-h-[350px]">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/90 backdrop-blur text-slate-400 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider">Personal</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">Horas</th>
                    <th className="px-6 py-3 font-semibold uppercase tracking-wider text-right">A Pagar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                {balancesList.filter(w => w.totalHours > 0).sort((a,b) => b.totalCost - a.totalCost).map((w, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-3 font-bold text-slate-200 flex items-center space-x-2">
                      <span className="text-base">{w.avatar}</span>
                      <span>{w.name}</span>
                    </td>
                    <td className="px-6 py-3 text-right text-slate-300">{parseFloat(w.totalHours.toFixed(2))} h</td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-400">{w.totalCost.toFixed(2)} €</td>
                  </tr>
                ))}
                {balancesList.filter(w => w.totalHours > 0).length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No hay horas de personal en este periodo.</td>
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
                      label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (
                          <text 
                            x={x} 
                            y={y} 
                            fill="#f8fafc" 
                            textAnchor={x > cx ? 'start' : 'end'} 
                            dominantBaseline="central" 
                            fontSize={11} 
                            fontWeight="bold"
                            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                          >
                            {`${(percent * 100).toFixed(1)}%`}
                          </text>
                        );
                      }}
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
