import React, { useState } from 'react';
import { ChevronDown, NotebookPen } from 'lucide-react';
import Seccion from '../../ui/Seccion';
import Desplegable from '../../ui/Desplegable';
import { TIPOS_CONCEPTO } from '../../../data/conceptosSaldos';
import { formatearEuros, formatearEurosConSigno } from '../../../data/formatoFinanciero';

// Lo apuntado a mano en Saldos & Acuerdos dentro del periodo (conceptosDelPeriodo):
// el COSTE que no sale de los fichajes (turnos a mano, transporte, bolsa, ajustes) y,
// aparte, lo ya PAGADO (efectivo, Bizum, adelantos), que resta del saldo de cada
// persona pero no es coste. Al pie: coste total (extras fichados + a mano), lo pagado
// y, en «Todo», lo que queda por pagar.
const Linea = ({ texto, valor, fuerte = false }) => (
  <div className="flex items-center justify-between gap-3 text-xs">
    <span className="font-bold uppercase tracking-wider text-slate-400">{texto}</span>
    <span className={`shrink-0 whitespace-nowrap tabular-nums ${fuerte ? 'text-sm font-extrabold text-amber-400' : 'font-bold text-slate-300'}`}>{valor}</span>
  </div>
);

export default function ConceptosAMano({ conceptos, extrasFichados, todo, retraso = 0 }) {
  const [abierto, setAbierto] = useState(null);
  const tipos = Object.entries(conceptos.porTipo).filter(([tipo]) => tipo !== 'pago');
  const pagos = conceptos.porTipo.pago;
  const coste = extrasFichados + conceptos.total;

  const pie = (
    <div className="space-y-1.5">
      <Linea texto="Coste: extras fichados + a mano" valor={formatearEuros(coste)} fuerte />
      {pagos && <Linea texto={todo ? 'Ya pagado' : 'Pagado en este periodo'} valor={formatearEuros(conceptos.pagado)} />}
      {todo && pagos && <Linea texto="Queda por pagar" valor={formatearEuros(coste - conceptos.pagado)} fuerte />}
    </div>
  );

  const fila = (tipo, importe, n, pago = false) => {
    const items = conceptos.items.filter(i => i.tipo === tipo);
    const esAbierto = abierto === tipo;
    return (
      <li key={tipo} className="border-b border-slate-800/70 last:border-b-0">
        <button
          type="button"
          onClick={() => setAbierto(esAbierto ? null : tipo)}
          aria-expanded={esAbierto}
          className="group flex w-full items-center justify-between gap-3 px-3.5 sm:px-5 py-3 text-left transition-colors hover:bg-slate-800/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-100">{TIPOS_CONCEPTO[tipo]}</span>
            <span className="text-[11px] text-slate-500">{n} {n === 1 ? 'concepto' : 'conceptos'}{pago ? ' · resta del saldo, no es coste' : ''}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className={`whitespace-nowrap text-sm font-bold tabular-nums ${pago ? 'text-sky-300' : importe < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
              {pago ? formatearEuros(-importe) : formatearEurosConSigno(importe)}
            </span>
            <ChevronDown aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${esAbierto ? 'rotate-180 text-amber-400' : ''}`} />
          </span>
        </button>
        <Desplegable abierto={esAbierto}>
          <ul className="mx-3.5 sm:mx-5 mb-3 space-y-1 rounded-xl border border-slate-800/70 bg-slate-950/60 p-2.5">
            {items.map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-3 text-xs">
                <span className="min-w-0 text-slate-300"><b className="text-slate-200">{it.persona}</b> · <span className="break-words">{it.concepto}</span></span>
                <span className={`shrink-0 whitespace-nowrap tabular-nums ${it.importe < 0 && !pago ? 'text-rose-400' : 'text-slate-300'}`}>{pago ? formatearEuros(-it.importe) : formatearEurosConSigno(it.importe)}</span>
              </li>
            ))}
          </ul>
        </Desplegable>
      </li>
    );
  };

  return (
    <Seccion titulo="Apuntado a mano en Saldos & Acuerdos" subtitulo="Lo que no sale de los fichajes: turnos a mano, transporte, ajustes y pagos" icono={NotebookPen} color="text-rose-300" retraso={retraso} pie={tipos.length || pagos ? pie : null}>
      {tipos.length === 0 && !pagos ? (
        <p className="px-3.5 sm:px-5 py-4 text-xs text-slate-500">Nada apuntado a mano en este periodo.</p>
      ) : (
        <ul className="flex-1">
          {tipos.map(([tipo, { importe, conceptos: n }]) => fila(tipo, importe, n))}
          {pagos && fila('pago', pagos.importe, pagos.conceptos, true)}
        </ul>
      )}
      {!todo && conceptos.sinFechaFuera > 0 && (
        <p className="border-t border-slate-800 px-3.5 sm:px-5 py-2.5 text-[11px] text-slate-500">
          {conceptos.sinFechaFuera} {conceptos.sinFechaFuera === 1 ? 'concepto antiguo no lleva' : 'conceptos antiguos no llevan'} fecha (roturas, pagos, la bolsa acumulada…): no son de ninguna semana concreta; cuentan en septiembre de 2026, en ese año y en «Todo» (la bolsa acumulada, solo en «Todo»). Los nuevos ya la guardan.
        </p>
      )}
    </Seccion>
  );
}
