import React from 'react';
import { Campo, Input } from '../../ui/Campo';
import { aIso } from '../../../data/fechasSemana';

// Un concepto a mano que no es un turno: algo que SUMAR (un plus, el transporte…) o, con
// `pago`, dinero ya entregado (efectivo, Bizum, un adelanto: se guarda en negativo).
// Lleva la fecha del día al que corresponde (por defecto, hoy): así se sabe de cuándo
// es cada transporte o cada pago, y el Resumen lo pone en su semana.
// `onGuardar(importe)`: el importe ya con su signo.
export default function FormularioConcepto({ pago = false, texto, importe, fecha, onTexto, onImporte, onFecha, onGuardar, onCancelar, guardando = false }) {
  const valor = parseFloat(String(importe).replace(',', '.'));
  const campo = { tamano: 'xs', fondo: 'medio', borde: 'marcado', acento: pago ? 'rose' : 'amber' };
  return (
    <>
      <Input type="text" value={texto} onChange={(e) => onTexto(e.target.value)} placeholder={pago ? 'Concepto (ej: Adelanto nómina, Pago Bizum)' : 'Concepto (ej: Plus puntualidad)'} {...campo} />
      <Input type="text" inputMode="decimal" value={importe} onChange={(e) => onImporte(e.target.value)} placeholder={pago ? 'Importe a RESTAR (se pondrá en negativo)' : 'Importe a SUMAR (ej: 20.00)'} texto={pago ? 'rosa' : 'blanco'} {...campo} />
      <Campo etiqueta={pago ? 'Día en que se pagó' : 'Día al que corresponde'} compacta>
        <Input type="date" value={fecha} max={aIso(new Date())} onChange={(e) => onFecha(e.target.value)} {...campo} />
      </Campo>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onGuardar(pago ? -Math.abs(valor) : valor)}
          disabled={guardando || !texto.trim() || Number.isNaN(valor)}
          className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all disabled:opacity-50 ${pago ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20 hover:bg-rose-500' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'}`}
        >
          {guardando ? 'Guardando...' : pago ? 'Registrar Adelanto' : 'Añadir Importe'}
        </button>
        <button type="button" onClick={onCancelar} className="flex-1 rounded-lg bg-slate-800 py-2 text-xs font-bold text-slate-300 transition-all hover:bg-slate-700">
          Cancelar
        </button>
      </div>
    </>
  );
}
