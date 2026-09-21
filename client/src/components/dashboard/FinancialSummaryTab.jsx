import React, { useMemo, useState } from 'react';
import { Wallet, Banknote, Users, Clock, Inbox, Layers, BarChart3, PieChart, Info, TrendingUp, TrendingDown } from 'lucide-react';
import { aggregateShiftsByWorker } from '../../data/shiftCalculations';
import { buildPaxRegistry, buildTaskContextResolver } from '../../data/eventNaming';
import { summarizeByEvent } from '../../data/eventSummary';
import { repartirTiempoSinTarea } from '../../data/repartoPorPlanning';
import { getWeekRange } from '../../data/taskPlanning';
import { rangoDePeriodo, moverPeriodo, turnosDelPeriodo, semanasDelPeriodo, serieDelPeriodo, costeTotal, variacionPorcentual } from '../../data/periodosFinancieros';
import { formatearEuros, formatearHoras, formatearPorcentaje } from '../../data/formatoFinanciero';
import SelectorPeriodo from './financiero/SelectorPeriodo';
import KpiCard from '../ui/KpiCard';
import Seccion from '../ui/Seccion';
import FilaDesglose from './financiero/FilaDesglose';
import GraficoEvolucion from './financiero/GraficoEvolucion';
import DonutHoras from './financiero/DonutHoras';

// Con el planning de la semana abierta como punto de partida; si no tiene fechas
// legibles, la semana de hoy.
const anclaInicial = (semana) => getWeekRange(semana)?.start || new Date();

const TITULO_SERIE = { semana: 'Coste por día', mes: 'Coste por semana', anio: 'Coste por mes', todo: 'Coste por mes' };
const NOMBRE_ANTERIOR = { semana: 'semana anterior', mes: 'mes anterior', anio: 'año anterior' };
const DATOS_ANTERIOR = { semana: 'de la semana anterior', mes: 'del mes anterior', anio: 'del año anterior' };
const PASO_FILA = 45; // ms entre fila y fila al aparecer

// "a 10,00 € / hora" si todos cobran lo mismo; null si hay tarifas distintas.
const tarifaComun = (personal) => {
  const tarifas = [...new Set(personal.map(w => w.rate).filter(Boolean))];
  return tarifas.length === 1 ? `a ${formatearEuros(tarifas[0])} / hora` : null;
};

export default function FinancialSummaryTab({ shifts = [], workersList = [], allWeeks = {}, activeWeekData = null }) {
  const [modo, setModo] = useState('semana');
  const [ancla, setAncla] = useState(() => anclaInicial(activeWeekData));

  const rango = useMemo(() => rangoDePeriodo(modo, ancla, allWeeks), [modo, ancla, allWeeks]);
  const turnos = useMemo(() => turnosDelPeriodo(shifts, rango), [shifts, rango]);

  const balancesList = useMemo(() => Object.values(aggregateShiftsByWorker(turnos, workersList)), [turnos, workersList]);
  const conHoras = useMemo(() => balancesList.filter(w => w.totalHours > 0).sort((a, b) => b.totalCost - a.totalCost), [balancesList]);
  const totalExtraExpense = balancesList.reduce((acc, w) => acc + (w.isPayroll ? 0 : w.totalCost), 0);
  const totalPayrollValuation = balancesList.reduce((acc, w) => acc + (w.isPayroll ? w.totalCost : 0), 0);
  const totalHoras = balancesList.reduce((acc, w) => acc + w.totalHours, 0);
  const totalCoste = totalExtraExpense + totalPayrollValuation;

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
  const costeEventos = eventsList.reduce((acc, e) => acc + e.totalCost, 0);

  const serie = useMemo(() => serieDelPeriodo(turnos, rango), [turnos, rango]);

  // Comparación con el periodo anterior (no tiene sentido en "todo").
  const variacion = useMemo(() => {
    if (modo === 'todo') return null;
    const anterior = rangoDePeriodo(modo, moverPeriodo(modo, ancla, -1), allWeeks);
    return variacionPorcentual(costeTotal(turnos), costeTotal(turnosDelPeriodo(shifts, anterior)));
  }, [modo, ancla, allWeeks, shifts, turnos]);

  const ultimoFichaje = useMemo(() => {
    const tiempos = shifts.map(s => new Date(s.startEntry?.timestamp).getTime()).filter(t => !isNaN(t));
    return tiempos.length ? new Date(Math.max(...tiempos)) : null;
  }, [shifts]);

  const cambiarModo = (nuevo) => {
    // Al pasar de "todo" a un periodo concreto se vuelve a la semana abierta.
    if (modo === 'todo') setAncla(anclaInicial(activeWeekData));
    setModo(nuevo);
  };
  const siguienteEsFuturo = modo !== 'todo' && rangoDePeriodo(modo, moverPeriodo(modo, ancla, 1), allWeeks).desde > new Date();

  const extras = balancesList.filter(w => !w.isPayroll && w.totalHours > 0);
  const enNomina = balancesList.filter(w => w.isPayroll && w.totalHours > 0);
  const costeMedioHora = totalHoras > 0 ? totalCoste / totalHoras : 0;

  const pieCoste = modo === 'todo' ? (
    <span>Extras + valoración de nómina</span>
  ) : variacion === null ? (
    <span>Sin datos {DATOS_ANTERIOR[modo]} para comparar</span>
  ) : (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${variacion > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
        {variacion > 0 ? <TrendingUp className="h-3 w-3" aria-hidden="true" /> : <TrendingDown className="h-3 w-3" aria-hidden="true" />}
        {variacion > 0 ? '+' : ''}{formatearPorcentaje(variacion)}
      </span>
      <span>vs {NOMBRE_ANTERIOR[modo]}</span>
    </span>
  );

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      {/* Periodo: semana (martes a lunes, como el planning), mes, año o todo */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg p-3 sm:p-4 animate-aparecer motion-reduce:animate-none">
        <SelectorPeriodo
          modo={modo}
          etiqueta={rango.etiqueta}
          onCambiarModo={cambiarModo}
          onAnterior={() => setAncla(moverPeriodo(modo, ancla, -1))}
          onSiguiente={() => setAncla(moverPeriodo(modo, ancla, 1))}
          siguienteDeshabilitado={siguienteEsFuturo}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          className="col-span-2 sm:col-span-1"
          titulo="Coste de personal"
          valor={totalCoste}
          formato={formatearEuros}
          icono={Wallet}
          color="amber"
          pie={pieCoste}
          retraso={60}
        />
        <KpiCard
          titulo="Extras a pagar"
          valor={totalExtraExpense}
          formato={formatearEuros}
          icono={Banknote}
          color="sky"
          pie={`Personal extra ${tarifaComun(extras) ?? 'con tarifas distintas'}`}
          retraso={120}
        />
        <KpiCard
          titulo="Valoración nóminas"
          valor={totalPayrollValuation}
          formato={formatearEuros}
          icono={Users}
          color="indigo"
          pie={enNomina.length > 0 ? `${enNomina.map(w => w.name).join(' + ')} · valoración interna ${tarifaComun(enNomina) ?? ''}`.trim() : 'Valoración interna del personal en nómina'}
          retraso={180}
        />
        <KpiCard
          className="col-span-2 sm:col-span-1"
          titulo="Horas registradas"
          valor={totalHoras}
          formato={formatearHoras}
          icono={Clock}
          color="emerald"
          pie={`${turnos.length} ${turnos.length === 1 ? 'turno fichado' : 'turnos fichados'}${totalHoras > 0 ? ` · ${formatearEuros(costeMedioHora)}/h de media` : ''}`}
          retraso={240}
        />
      </div>

      {turnos.length === 0 ? (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-2xl px-4 py-10 sm:py-14 text-center animate-aparecer motion-reduce:animate-none" style={{ animationDelay: '300ms' }}>
          <Inbox className="mx-auto h-9 w-9 text-slate-600" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-slate-300">No hay fichajes en este periodo.</p>
          <p className="mt-1 text-xs text-slate-500">Prueba con otro periodo o con «Todo» para ver el histórico completo.</p>
          {ultimoFichaje && modo !== 'todo' && (
            <button
              type="button"
              onClick={() => setAncla(ultimoFichaje)}
              className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            >
              Ir al último periodo con fichajes
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <Seccion
              className="lg:col-span-2"
              titulo={TITULO_SERIE[modo]}
              subtitulo="Coste de personal en cada tramo del periodo"
              icono={BarChart3}
              retraso={300}
            >
              <GraficoEvolucion serie={serie} />
            </Seccion>
            <Seccion titulo="Distribución de horas" subtitulo="Reparto entre el personal" icono={PieChart} color="text-sky-300" retraso={360}>
              <DonutHoras
                datos={[...conHoras].sort((a, b) => b.totalHours - a.totalHours).map(w => ({ nombre: w.name, horas: w.totalHours }))}
                totalHoras={totalHoras}
              />
            </Seccion>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
            <Seccion titulo="Desglose por evento" subtitulo="Pulsa un evento para ver quién trabajó en él" icono={Layers} color="text-indigo-300" retraso={420}>
              {horasEstimadas > 0.05 && (
                <p className="flex items-start gap-2 border-b border-slate-800 bg-slate-950/50 px-3.5 sm:px-5 py-2.5 text-[11px] leading-snug text-slate-400">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    <span className="font-bold text-amber-400">≈ {formatearHoras(horasEstimadas)}</span> son jornadas fichadas sin tarea concreta,
                    repartidas entre los eventos en los que esa persona estaba asignada según el planning. El total de horas y de dinero no cambia.
                  </span>
                </p>
              )}
              <ul>
                {eventsList.map((evt, i) => (
                  <FilaDesglose
                    key={evt.eventName}
                    titulo={evt.eventName}
                    insignia={evt.pax ? `${evt.pax} pax` : null}
                    nota={evt.horasEstimadas > 0.05 ? `≈ ${formatearHoras(evt.horasEstimadas)} por planning` : null}
                    horas={evt.totalHours}
                    coste={evt.totalCost}
                    porcentaje={costeEventos > 0 ? (evt.totalCost / costeEventos) * 100 : 0}
                    detalle={Object.values(evt.workers).sort((a, b) => b.cost - a.cost).map(w => ({ nombre: w.name, icono: w.avatar, horas: w.hours, coste: w.cost }))}
                    retraso={460 + i * PASO_FILA}
                  />
                ))}
              </ul>
            </Seccion>

            <Seccion titulo="Coste por trabajador" subtitulo="Pulsa a una persona para ver en qué eventos trabajó" icono={Users} color="text-emerald-300" retraso={480}>
              <ul>
                {conHoras.map((w, i) => (
                  <FilaDesglose
                    key={w.name}
                    icono={w.avatar}
                    titulo={w.name}
                    insignia={w.isPayroll ? 'Nómina' : null}
                    nota={w.role}
                    horas={w.totalHours}
                    coste={w.totalCost}
                    porcentaje={totalCoste > 0 ? (w.totalCost / totalCoste) * 100 : 0}
                    detalle={eventsList
                      .filter(evt => evt.workers[w.name])
                      .map(evt => ({ nombre: evt.eventName, horas: evt.workers[w.name].hours, coste: evt.workers[w.name].cost }))
                      .sort((a, b) => b.coste - a.coste)}
                    retraso={520 + i * PASO_FILA}
                  />
                ))}
              </ul>
            </Seccion>
          </div>
        </>
      )}
    </div>
  );
}
