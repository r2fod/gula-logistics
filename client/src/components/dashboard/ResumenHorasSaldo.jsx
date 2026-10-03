import React, { useMemo } from 'react';
import { Clock, Wallet } from 'lucide-react';
import EnVivo from '../ui/EnVivo';
import { formatearHoras, formatearEurosConSigno } from '../../data/formatoFinanciero';
import { rangoDePeriodo, horasDelPeriodo } from '../../data/periodosFinancieros';
import { formatMonthName } from '../../utils/dateUtils';
import { useAhora } from '../../hooks/useAhora';
import { costeEnCurso } from '../../data/costeEnVivo';
import { pairShiftsFromEntries, aggregateShiftsByWorker } from '../../data/shiftCalculations';
import { buscarPorNombreDeSaldo } from '../../data/saldosEquipo';
import { saldoDeTrabajador } from '../../data/saldoTrabajador';
import { useMiSaldo } from '../../hooks/useMiSaldo';

// Un dato del resumen. Nunca recorta: si no caben los dos en una fila (móvil
// estrecho o letra grande), el segundo baja entero debajo.
function Dato({ icono: Icono, etiqueta, children, pie = null, tono = 'text-emerald-400' }) {
  return (
    <div className="flex-1 min-w-[9.5rem] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
      <p className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{etiqueta}
      </p>
      <p className={`mt-0.5 whitespace-nowrap font-mono text-lg font-extrabold tabular-nums ${tono}`}>{children}</p>
      {pie && <p className="text-[11px] leading-snug text-slate-500">{pie}</p>}
    </div>
  );
}

// Una cifra de horas con lo que abarca debajo ("semana", "septiembre").
function Horas({ valor, texto }) {
  return (
    <span className="whitespace-nowrap">
      <span className="block font-mono text-lg font-extrabold tabular-nums text-sky-300">{valor}</span>
      <span className="block font-sans text-[11px] font-normal text-slate-500">{texto}</span>
    </span>
  );
}

// Horas de la semana y del mes, y lo que tiene pendiente de cobro, en la vista del
// propio trabajador. Semana (martes a lunes) y mes como en el Resumen Financiero
// (periodosFinancieros.js): un turno cuenta en el periodo en que empieza, a la media
// hora. Suben en directo mientras está en turno (<EnVivo>), y el saldo es la
// MISMA cuenta que Saldos & Acuerdos (saldoDeTrabajador): lo que el admin apunte allí
// (un pago, un ajuste) le llega aquí en unos segundos (useMiSaldo). El saldo solo
// sale con su enlace personal firmado; en nómina fija no se enseñan euros.
//
// Props: nombre, enNomina, turnoAbierto (su entrada sin salida, o null),
// fichajesDeTodo (el histórico: el mes y el saldo cuentan todos sus turnos) y equipo.
export default function ResumenHorasSaldo({ nombre, enNomina = false, turnoAbierto = null, fichajesDeTodo = [], equipo = [] }) {
  const { ficha, sinEnlace } = useMiSaldo(nombre);
  const ahora = useAhora(60 * 1000); // para cambiar de semana y de mes sin recargar

  const turnos = useMemo(() => pairShiftsFromEntries(fichajesDeTodo).shifts, [fichajesDeTodo]);
  const horas = useMemo(
    () => (ficha ? buscarPorNombreDeSaldo(aggregateShiftsByWorker(turnos, equipo), ficha.name) : null),
    [ficha, turnos, equipo]
  );

  const suyos = turnos.filter(t => String(t.workerName || '').trim().toLowerCase() === String(nombre || '').trim().toLowerCase());
  const periodo = (modo) => {
    const rango = rangoDePeriodo(modo, ahora);
    const cerradas = horasDelPeriodo(suyos, rango);
    const inicioAbierto = turnoAbierto ? new Date(turnoAbierto.timestamp).getTime() : NaN;
    const abiertoDentro = inicioAbierto >= rango.desde.getTime() && inicioAbierto < rango.hasta.getTime();
    return { rango, cerradas, abiertoDentro };
  };
  const semana = periodo('semana');
  const mes = periodo('mes');

  const saldo = ficha ? saldoDeTrabajador({ ficha, horas, abierto: turnoAbierto }) : null;
  const verSaldo = !!saldo && !saldo.enNomina && !enNomina;
  const horasAbiertas = (ahora) => (turnoAbierto ? costeEnCurso({ entrada: turnoAbierto, ahora, tarifa: 0 }).horas : 0);
  const colorSaldo = (valor) => (valor > 0 ? 'text-emerald-400' : valor < 0 ? 'text-rose-400' : 'text-slate-300');

  return (
    <section aria-label="Tus horas y tu saldo" className="mt-3 flex flex-wrap gap-2">
      <Dato icono={Clock} etiqueta="Horas" tono="text-sky-300" pie={turnoAbierto ? 'Con el turno en curso' : null}>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          {[[semana, 'semana'], [mes, formatMonthName(mes.rango.desde)]].map(([p, texto]) => (
            p.abiertoDentro
              ? <EnVivo key={texto}>{(momento) => <Horas valor={formatearHoras(p.cerradas + horasAbiertas(momento))} texto={texto} />}</EnVivo>
              : <Horas key={texto} valor={formatearHoras(p.cerradas)} texto={texto} />
          ))}
        </span>
      </Dato>

      {verSaldo && (
        <Dato
          icono={Wallet}
          etiqueta={saldo.cerrado < 0 ? 'Adelantado' : 'Por cobrar'}
          tono={colorSaldo(saldo.cerrado)}
          pie={saldo.cobraEnDirecto ? 'Sube con tu turno' : 'Al día con tus pagos'}
        >
          {saldo.cobraEnDirecto
            ? <EnVivo>{(ahora) => formatearEurosConSigno(saldo.cerrado + saldo.enCurso(ahora))}</EnVivo>
            : formatearEurosConSigno(saldo.cerrado)}
        </Dato>
      )}

      {!verSaldo && sinEnlace && !enNomina && (
        <p className="basis-full text-[11px] leading-snug text-slate-500">
          Para ver aquí lo que tienes pendiente de cobro, pide tu enlace personal al administrador.
        </p>
      )}
    </section>
  );
}
