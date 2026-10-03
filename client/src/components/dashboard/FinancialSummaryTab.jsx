import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Banknote, Users, Clock, Inbox, Layers, BarChart3, PieChart, Info, TrendingUp, TrendingDown, Copy, Check } from 'lucide-react';
import { aggregateShiftsByWorker } from '../../data/shiftCalculations';
import { buildPaxRegistry, buildTaskContextResolver, esBorradorSemana } from '../../data/eventNaming';
import { summarizeByEvent } from '../../data/eventSummary';
import { repartirTiempoSinTarea } from '../../data/repartoPorPlanning';
import { getWeekRange } from '../../data/taskPlanning';
import { rangoDePeriodo, moverPeriodo, turnosDelPeriodo, semanasDelPeriodo, serieDelPeriodo, costeTotal, variacionPorcentual } from '../../data/periodosFinancieros';
import { formatearEuros, formatearHoras, formatearPorcentaje } from '../../data/formatoFinanciero';
import SelectorPeriodo from './financiero/SelectorPeriodo';
import KpiCard from '../ui/KpiCard';
import EnVivo from '../ui/EnVivo';
import Seccion from '../ui/Seccion';
import FilaDesglose from './financiero/FilaDesglose';
import GraficoEvolucion from './financiero/GraficoEvolucion';
import DonutHoras from './financiero/DonutHoras';
import ConceptosAMano from './financiero/ConceptosAMano';
import PrevistoPlanning from './financiero/PrevistoPlanning';
import { aplicarTarifaDeBolsa } from '../../data/bolsaHoras';
import { conceptosDelPeriodo } from '../../data/conceptosSaldos';
import { estimarHorasPlanning } from '../../data/estimadoPlanning';
import { enCursoDelPeriodo } from '../../data/costeEnVivo';
import { textoResumenWhatsApp } from '../../data/resumenWhatsApp';
import { coincideNombre } from '../../data/nombresTrabajadores';
import { useCopiado } from '../../hooks/useCopiado';

// Con el planning de la semana abierta (la del selector de arriba) como punto de
// partida; si no tiene fechas legibles, la semana de hoy.
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

// Franja de totales al pie de cada lista: las dos tarjetas de al lado miden lo mismo
// y esta fila queda a la misma altura en las dos.
// Pie de "Extras a pagar" con alguien fichado ahora: lo que va sumando su turno.
const EnCurso = ({ importe }) => (
  <span className="flex items-center gap-1.5 text-emerald-300/90">
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
    <span>Incluye <b className="font-mono tabular-nums">{formatearEuros(importe)}</b> de turnos en curso</span>
  </span>
);

const TotalPie = ({ horas, coste }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="font-bold uppercase tracking-wider text-slate-400">Total</span>
    <span className="tabular-nums text-slate-400">
      {formatearHoras(horas)} <span className="text-slate-600">·</span> <span className="text-sm font-extrabold text-amber-400">{formatearEuros(coste)}</span>
    </span>
  </div>
);

// `saldos`: fichas de Saldos & Acuerdos (bolsa de horas y conceptos a mano).
// `enfoque`: { persona } al llegar desde "Ver en Resumen" de Saldos — todo el
// histórico, con esa persona abierta en "Coste por trabajador".
export default function FinancialSummaryTab({ shifts = [], workersList = [], allWeeks = {}, activeWeekData = null, saldos = [], enfoque = null, turnosAbiertos = {} }) {
  const [modo, setModo] = useState(() => (enfoque?.persona ? 'todo' : 'semana'));
  const [ancla, setAncla] = useState(() => anclaInicial(activeWeekData));
  const [copiado, copiar] = useCopiado();

  // Quien tiene bolsa de horas cuesta lo mismo que en Saldos & Acuerdos (bolsaHoras.js).
  // Se aplica al histórico entero: la bolsa se va gastando turno a turno.
  const turnosConTarifa = useMemo(() => aplicarTarifaDeBolsa(shifts, saldos), [shifts, saldos]);
  const abiertos = useMemo(() => Object.values(turnosAbiertos || {}), [turnosAbiertos]);

  // El resumen sigue a la semana que se elige arriba: al cambiarla, el periodo pasa a
  // ser esa semana (o el mes o año que la contiene). Las flechas y los botones de
  // periodo siguen funcionando después, a partir de ahí.
  const inicioActiva = getWeekRange(activeWeekData)?.start?.getTime() ?? null;
  useEffect(() => { setAncla(inicioActiva ? new Date(inicioActiva) : new Date()); }, [inicioActiva]);

  const rango = useMemo(() => rangoDePeriodo(modo, ancla, allWeeks), [modo, ancla, allWeeks]);
  const turnos = useMemo(() => turnosDelPeriodo(turnosConTarifa, rango), [turnosConTarifa, rango]);

  // Lo apuntado a mano en Saldos en este periodo.
  const conceptos = useMemo(() => conceptosDelPeriodo(saldos, rango, { incluirSinFecha: modo === 'todo' }), [saldos, rango, modo]);

  const balancesList = useMemo(() => {
    const list = Object.values(aggregateShiftsByWorker(turnos, workersList));
    const copy = list.map(w => ({ ...w, shifts: [...w.shifts] }));

    if (conceptos && conceptos.items) {
      conceptos.items.forEach(it => {
        if (it.tipo === 'pago') return; // pagos do not add to cost

        let worker = copy.find(w => coincideNombre(w.name, it.persona));
        if (!worker) {
          worker = { id: it.persona.toLowerCase().replace(/\s+/g, '-'), name: it.persona, isPayroll: false, totalHours: 0, totalCost: 0, shifts: [] };
          copy.push(worker);
        }

        worker.totalCost = (worker.totalCost || 0) + it.importe;
        worker.totalHours = (worker.totalHours || 0) + (it.horas || 0); // turnos y bolsa a mano (horasDeConcepto)
      });
    }
    return copy;
  }, [turnos, workersList, conceptos]);
  // Quien tiene horas o dinero en el periodo (alguien con solo un ajuste a mano, sin horas,
  // también suma en el total: si no saliera en la lista, la lista no cuadraría con él).
  const conHoras = useMemo(() => balancesList.filter(w => w.totalHours > 0 || Math.abs(w.totalCost || 0) > 0.005).sort((a, b) => b.totalCost - a.totalCost), [balancesList]);
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
  // Lo apuntado a mano no es de ningún evento: va en su propia fila, para que el total
  // del desglose por evento sea el mismo que el de "Coste por trabajador".
  const aManoSinEvento = useMemo(() => {
    const items = (conceptos?.items || []).filter(it => it.tipo !== 'pago');
    return items.length ? { coste: conceptos.total, horas: items.reduce((suma, it) => suma + (it.horas || 0), 0), items } : null;
  }, [conceptos]);
  const costeEventos = eventsList.reduce((acc, e) => acc + e.totalCost, 0) + (aManoSinEvento?.coste || 0);
  const horasEventos = eventsList.reduce((acc, e) => acc + e.totalHours, 0) + (aManoSinEvento?.horas || 0);

  const serie = useMemo(() => serieDelPeriodo(turnos, rango), [turnos, rango]);

  // Comparación con el periodo anterior (no tiene sentido en "todo").
  const variacion = useMemo(() => {
    if (modo === 'todo') return null;
    // Con lo apuntado a mano, como el "Coste de personal" que se compara.
    const anterior = rangoDePeriodo(modo, moverPeriodo(modo, ancla, -1), allWeeks);
    const aManoAnterior = conceptosDelPeriodo(saldos, anterior).total;
    return variacionPorcentual(costeTotal(turnos) + conceptos.total, costeTotal(turnosDelPeriodo(turnosConTarifa, anterior)) + aManoAnterior);
  }, [modo, ancla, allWeeks, turnosConTarifa, turnos, conceptos, saldos]);

  // Lo apuntado a mano en Saldos en este periodo, y lo previsto por el planning
  // de la semana (solo en la vista de una semana).
  const estimado = useMemo(() => {
    if (modo !== 'semana') return null;
    const semana = Object.values(semanasDelPeriodo(allWeeks, rango)).find(w => w && !esBorradorSemana(w));
    return semana ? estimarHorasPlanning(semana, workersList) : null;
  }, [modo, allWeeks, rango, workersList]);

  const ultimoFichaje = useMemo(() => {
    const tiempos = shifts.map(s => new Date(s.startEntry?.timestamp).getTime()).filter(t => !isNaN(t));
    return tiempos.length ? new Date(Math.max(...tiempos)) : null;
  }, [shifts]);

  // Pulsar Semana, Mes o Año enseña siempre los números de la semana elegida arriba (o
  // de su mes o año), aunque se hubiera ido a otro periodo con las flechas.
  const cambiarModo = (nuevo) => {
    setAncla(anclaInicial(activeWeekData));
    setModo(nuevo);
  };
  const siguienteEsFuturo = modo !== 'todo' && rangoDePeriodo(modo, moverPeriodo(modo, ancla, 1), allWeeks).desde > new Date();

  const personaEnfocada = enfoque?.persona ? conHoras.find(w => coincideNombre(w.name, enfoque.persona))?.name : null;
  const copiarParaWhatsApp = () => copiar(textoResumenWhatsApp({
    etiqueta: rango.etiqueta, personas: conHoras, totalExtras: totalExtraExpense, totalNomina: totalPayrollValuation, totalHoras, conceptos, estimado,
  }));

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

  // Las cuatro cifras de arriba. `vivo` (enCursoDelPeriodo): lo que llevan ahora los
  // turnos abiertos del periodo, que se suma a lo ya fichado; null si no hay ninguno.
  const rejillaKpi = (vivo) => {
    const extrasVivo = vivo?.extras || 0;
    const nominaVivo = vivo?.nomina || 0;
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          className="col-span-2 sm:col-span-1"
          titulo="Coste de personal"
          valor={totalCoste + extrasVivo + nominaVivo}
          formato={formatearEuros}
          icono={Wallet}
          color="amber"
          pie={pieCoste}
          retraso={60}
        />
        <KpiCard
          titulo="Extras a pagar"
          valor={totalExtraExpense + extrasVivo}
          formato={formatearEuros}
          icono={Banknote}
          color="sky"
          pie={extrasVivo > 0 ? <EnCurso importe={extrasVivo} /> : `Personal extra ${tarifaComun(extras) ?? 'con tarifas distintas'}`}
          retraso={120}
        />
        <KpiCard
          titulo="Valoración nóminas"
          valor={totalPayrollValuation + nominaVivo}
          formato={formatearEuros}
          icono={Users}
          color="indigo"
          pie={enNomina.length > 0 ? `${enNomina.map(w => w.name).join(' + ')} · valoración interna ${tarifaComun(enNomina) ?? ''}`.trim() : 'Valoración interna del personal en nómina'}
          retraso={180}
        />
        <KpiCard
          className="col-span-2 sm:col-span-1"
          titulo="Horas registradas"
          valor={totalHoras + (vivo?.horas || 0)}
          formato={formatearHoras}
          icono={Clock}
          color="emerald"
          pie={`${turnos.length} ${turnos.length === 1 ? 'turno fichado' : 'turnos fichados'}${vivo?.turnos ? ` + ${vivo.turnos} en curso` : ''}${totalHoras > 0 ? ` · ${formatearEuros(costeMedioHora)}/h de media` : ''}`}
          retraso={240}
        />
      </div>
    );
  };

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
        <div className="mt-3 flex justify-end border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={copiarParaWhatsApp}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:border-emerald-500/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            <span className={copiado ? 'text-emerald-400' : ''}>{copiado ? '¡Copiado!' : 'Copiar resumen para WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* Con alguien fichado ahora, las cifras suben en directo (solo se repinta esta rejilla). */}
      {abiertos.length > 0 ? <EnVivo>{(ahora) => rejillaKpi(enCursoDelPeriodo(abiertos, rango, { ahora, equipo: workersList, fichas: saldos, turnos: shifts }))}</EnVivo> : rejillaKpi(null)}

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-stretch">
            <Seccion titulo="Desglose por evento" subtitulo="Pulsa un evento para ver quién trabajó en él" icono={Layers} color="text-indigo-300" retraso={420} pie={<TotalPie horas={horasEventos} coste={costeEventos} />}>
              {horasEstimadas > 0.05 && (
                <p className="flex items-start gap-2 border-b border-slate-800 bg-slate-950/50 px-3.5 sm:px-5 py-2.5 text-[11px] leading-snug text-slate-400">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>
                    <span className="font-bold text-amber-400">≈ {formatearHoras(horasEstimadas)}</span> son jornadas fichadas sin tarea concreta,
                    repartidas entre los eventos en los que esa persona estaba asignada según el planning. El total de horas y de dinero no cambia.
                  </span>
                </p>
              )}
              <ul className="flex-1">
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
                {aManoSinEvento && (
                  <FilaDesglose
                    titulo="✍️ Apuntado a mano (sin evento)"
                    nota="Turnos a mano, bolsa, transporte y ajustes de Saldos"
                    horas={aManoSinEvento.horas}
                    coste={aManoSinEvento.coste}
                    porcentaje={costeEventos > 0 ? (aManoSinEvento.coste / costeEventos) * 100 : 0}
                    detalle={aManoSinEvento.items.map(it => ({ nombre: `${it.persona}: ${it.concepto}`, horas: it.horas, coste: it.importe }))}
                    retraso={460 + eventsList.length * PASO_FILA}
                  />
                )}
              </ul>
            </Seccion>

            <Seccion titulo="Coste por trabajador" subtitulo="Pulsa a una persona para ver en qué eventos trabajó" icono={Users} color="text-emerald-300" retraso={480} pie={<TotalPie horas={totalHoras} coste={totalCoste} />}>
              <ul className="flex-1">
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
                    detalle={(() => {
                      const eventos = eventsList
                        .filter(evt => evt.workers[w.name])
                        .map(evt => ({ nombre: evt.eventName, horas: evt.workers[w.name].hours, coste: evt.workers[w.name].cost }));

                      const manualesDelTrabajador = (conceptos?.items || []).filter(it => it.tipo !== 'pago' && coincideNombre(w.name, it.persona));
                      if (manualesDelTrabajador.length > 0) {
                        const costeManual = manualesDelTrabajador.reduce((suma, it) => suma + it.importe, 0);
                        const horasManual = manualesDelTrabajador.reduce((suma, it) => suma + (it.horas || 0), 0);
                        eventos.push({
                          nombre: 'Apuntado a mano (bolsa, ajustes...)',
                          icono: '✍️',
                          horas: horasManual,
                          coste: costeManual
                        });
                      }
                      return eventos.sort((a, b) => b.coste - a.coste);
                    })()}
                    retraso={520 + i * PASO_FILA}
                    destacada={w.name === personaEnfocada}
                  />
                ))}
              </ul>
            </Seccion>
          </div>
        </>
      )}

      <div className={`grid grid-cols-1 gap-4 sm:gap-6 items-stretch ${estimado ? 'lg:grid-cols-2' : ''}`}>
        <ConceptosAMano conceptos={conceptos} extrasFichados={totalExtraExpense - conceptos.total} todo={modo === 'todo'} retraso={560} />
        {estimado && (
          <PrevistoPlanning
            estimado={estimado}
            fichadas={Object.fromEntries(balancesList.map(w => [w.name, w.totalHours]))}
            retraso={600}
          />
        )}
      </div>
    </div>
  );
}
