import React, { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Selector } from '../../ui/Campo';

const TODOS = '__todos';

// Elegir un evento del periodo (o todos) y descargar su informe de personal en Excel:
// horas, entrada, salida, €/hora e importe de cada persona (excelEventos.js).
// `onDescargar(nombresDeEventos)` → promesa; si falla, se dice aquí mismo.
export default function DescargarExcel({ eventos = [], onDescargar }) {
  const [elegido, setElegido] = useState(TODOS);
  const [estado, setEstado] = useState(null); // null | 'generando' | { error }

  if (!eventos.length) return null;
  const nombres = elegido === TODOS ? eventos : eventos.filter(e => e === elegido);

  const descargar = async () => {
    setEstado('generando');
    try {
      await onDescargar(nombres.length ? nombres : eventos);
      setEstado(null);
    } catch (err) {
      setEstado({ error: `No se pudo generar el Excel: ${err.message}` });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/40 px-3.5 py-2.5 sm:px-5">
      <label htmlFor="excel-evento" className="sr-only">Evento para el Excel</label>
      <Selector id="excel-evento" value={elegido} onChange={(e) => setElegido(e.target.value)} tamano="2xs" acento="emerald" className="min-w-0 flex-1 sm:max-w-xs">
        <option value={TODOS}>Todos los eventos ({eventos.length})</option>
        {eventos.map(e => <option key={e} value={e}>{e}</option>)}
      </Selector>
      <button
        type="button"
        onClick={descargar}
        disabled={estado === 'generando'}
        className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-60"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
        {estado === 'generando' ? 'Generando…' : 'Descargar Excel'}
      </button>
      {estado?.error && <p role="alert" className="w-full text-[11px] text-rose-300">{estado.error}</p>}
    </div>
  );
}
