import React, { useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import BarraProgreso from '../../ui/BarraProgreso';
import { Campo, Input } from '../../ui/Campo';
import { estadoBolsa } from '../../../data/bolsaHoras';
import { formatearEuros, formatearHoras, formatearNumero } from '../../../data/formatoFinanciero';
import { formatMonthName, formatMonthYear } from '../../../utils/dateUtils';

const MES = /^\d{4}-\d{2}$/;
const fechaDelMes = (mes) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1);

// Bolsa de horas de una ficha de Saldos (isSpecialPurse). Sin meses en el acuerdo, lo
// de siempre: lo apuntado a mano en la bolsa. Con un acuerdo por meses
// (purseInfo.desde/hasta, ver bolsaHoras.js), la barra es la del mes en curso (a mano
// + fichado) y fuera del acuerdo todo va a la tarifa extra. El admin fija aquí los meses.
//
// Props: ficha, turnos (sus turnos fichados), admin, abierto/onAlternar (lista de turnos
// a mano), onGuardarMeses({ desde, hasta }), guardando y ahora.
export default function PanelBolsa({ ficha, turnos = [], admin = false, abierto = false, onAlternar, onGuardarMeses, guardando = false, ahora = new Date() }) {
  const p = ficha.purseInfo;
  const bolsa = estadoBolsa(ficha, turnos, ahora);
  const porcentaje = bolsa.porMeses
    ? (bolsa.total ? (bolsa.gastadas / bolsa.total) * 100 : 100)
    : (p.consumedHours / p.totalHours) * 100;

  return (
    <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-extrabold text-amber-300 flex items-center space-x-1 min-w-0">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{bolsa.porMeses ? `Bolsa de ${formatMonthName(fechaDelMes(bolsa.mes))} (${formatearHoras(p.totalHours)})` : 'Bolsa Mensual (80h)'}</span>
        </span>
        <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded shrink-0">
          {bolsa.porMeses && !bolsa.cubierto ? 'Fuera del acuerdo' : `${Math.round(Math.min(100, porcentaje))}% Consumido`}
        </span>
      </div>

      <BarraProgreso
        porcentaje={porcentaje}
        pista="h-2.5 bg-slate-950 border border-amber-500/20"
        relleno="bg-gradient-to-r from-amber-500 to-emerald-400"
        etiqueta="Horas de la bolsa consumidas"
      />

      {bolsa.porMeses && (
        <p className="text-[11px] text-amber-100/90 leading-snug">
          {bolsa.cubierto
            ? <>Este mes: <b>{formatearHoras(bolsa.gastadas)} de {formatearHoras(bolsa.total)}</b> a {formatearEuros(p.hourlyRate)}/h (a mano y fichadas); las siguientes, a {formatearEuros(p.extraRateAfter80h)}/h.</>
            : <>{formatMonthName(fechaDelMes(bolsa.mes))} queda fuera del acuerdo: todas las horas, a {formatearEuros(p.extraRateAfter80h)}/h.</>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">Condición Base:</span>
          <span className="font-semibold text-white">
            {formatearHoras(p.totalHours)} ({formatearNumero(p.grossBase, 0)}€ - {formatearNumero(p.housingDeduction, 0)}€ Aloj.) = <b>{formatearNumero(p.netFixedAt80h, 0)}€ Neto</b>
          </span>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[11px]">{bolsa.porMeses ? `A mano en ${formatMonthName(fechaDelMes(p.desde))}:` : 'Acumulado en la bolsa:'}</span>
          <span className="font-bold text-emerald-400">{formatearHoras(p.consumedHours)} ({formatearEuros(p.consumedValue)})</span>
        </div>
      </div>

      {/* `key`: si llega del servidor otro valor (al abrir se pinta antes la copia guardada en
          el navegador), los campos se ponen al día; si no, «Guardar» borraría los meses. */}
      {admin && onGuardarMeses && <MesesDelAcuerdo key={`${p.desde || ''}|${p.hasta || ''}`} purseInfo={p} onGuardar={onGuardarMeses} guardando={guardando} />}

      <button
        onClick={onAlternar}
        className="w-full py-1 text-center text-xs text-amber-400 font-semibold flex items-center justify-center space-x-1"
      >
        <span>{abierto ? 'Ocultar turnos bolsa' : `Ver turnos consumidos (${p.consumedHours}h)`}</span>
        {abierto ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {abierto && (
        <div className="pt-2 border-t border-amber-500/20 space-y-1 text-xs text-slate-300">
          {(p.shifts || []).map((s, idx) => (
            <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg">
              <span className="break-words min-w-0 flex-1 pr-2">📅 <b>{s.date}</b> ({s.range})</span>
              <span className="font-bold text-amber-400 shrink-0">{s.hours}h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Meses del acuerdo (AAAA-MM). Vacíos los dos: una sola bolsa, como antes.
function MesesDelAcuerdo({ purseInfo, onGuardar, guardando }) {
  const [desde, setDesde] = useState(purseInfo.desde || '');
  const [hasta, setHasta] = useState(purseInfo.hasta || '');
  const valido = (!desde && !hasta) || (MES.test(desde) && (!hasta || (MES.test(hasta) && hasta >= desde)));
  const cambiado = desde !== (purseInfo.desde || '') || hasta !== (purseInfo.hasta || '');
  const resumen = MES.test(purseInfo.desde || '')
    ? `Acuerdo de ${formatMonthYear(fechaDelMes(purseInfo.desde))}${MES.test(purseInfo.hasta || '') ? ` a ${formatMonthYear(fechaDelMes(purseInfo.hasta))}` : ' en adelante'}: la bolsa empieza de cero cada mes y fuera del acuerdo todo va a ${formatearEuros(purseInfo.extraRateAfter80h)}/h.`
    : 'Sin meses: una sola bolsa para siempre. Con meses, empieza de cero cada mes del acuerdo (las horas a mano cuentan en el primero).';

  return (
    <div className="pt-2 border-t border-amber-500/20 space-y-2">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
        <CalendarRange className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Meses del acuerdo
      </span>
      <div className="flex flex-wrap items-end gap-2">
        <Campo etiqueta="Desde" compacta className="flex-1 min-w-[8.5rem]">
          <Input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="AAAA-MM" tamano="xs" acento="amber-suave" />
        </Campo>
        <Campo etiqueta="Hasta (incluido)" compacta className="flex-1 min-w-[8.5rem]">
          <Input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="AAAA-MM" tamano="xs" acento="amber-suave" />
        </Campo>
        <button
          type="button"
          disabled={!valido || !cambiado || guardando}
          onClick={() => onGuardar({ desde, hasta })}
          className="w-full sm:w-auto py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold disabled:opacity-40 transition-colors"
        >
          Guardar meses
        </button>
      </div>
      {!valido && <p role="alert" className="text-[11px] text-rose-300">Escribe los meses como AAAA-MM; «hasta» no puede ir antes de «desde».</p>}
      <p className="text-[11px] text-slate-400 leading-snug">{resumen}</p>
    </div>
  );
}
