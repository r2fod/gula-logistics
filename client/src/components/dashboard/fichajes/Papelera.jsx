import React, { useState } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import Desplegable from '../../ui/Desplegable';
import InsigniaTipo from './InsigniaTipo';
import { fechaDeFichaje, horaDeFichaje } from '../../../data/fichajes';
import { useDialog } from '../../../contexts/DialogContext';
import { confirmarVaciarPapelera } from './confirmaciones';

// Fichajes borrados (siguen en la base, marcados como borrados) con su botón de
// restaurar, y «Vaciar papelera» para borrarlos para siempre (onVaciar). Solo admin.
// Antes vivía en el informe de Nóminas, donde además salía siempre vacía: aquel modal
// solo recibía los fichajes activos.
export default function Papelera({ borrados = [], onRestaurar, onVaciar = null }) {
  const { confirm } = useDialog();
  const [abierta, setAbierta] = useState(false);
  const ordenados = [...borrados].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const n = borrados.length;

  const vaciar = async () => {
    if (await confirmarVaciarPapelera(confirm, n)) onVaciar();
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setAbierta(a => !a)}
        aria-expanded={abierta}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Trash2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Papelera <span className="text-xs font-normal text-slate-500">({n})</span>
        </span>
        <ChevronDown aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${abierta ? 'rotate-180' : ''}`} />
      </button>
      <Desplegable abierto={abierta}>
        {ordenados.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-slate-500">La papelera está vacía.</p>
        ) : (
          <>
          {onVaciar && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-4 py-2.5">
              <p className="min-w-0 flex-1 text-[11px] text-slate-400">No cuentan en horas ni saldos. Se pueden restaurar hasta que vacíes la papelera.</p>
              <button
                type="button"
                onClick={vaciar}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Vaciar papelera
              </button>
            </div>
          )}
          <ul className="max-h-80 divide-y divide-slate-800/70 overflow-y-auto border-t border-slate-800">
            {ordenados.map(e => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="tabular-nums text-slate-400">{fechaDeFichaje(e)} {horaDeFichaje(e)}</span>
                  <InsigniaTipo tipo={e.type} />
                  <b className="text-slate-200">{e.workerName}</b>
                  {e.taskName && <span className="truncate text-slate-400">{e.taskName}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onRestaurar(e.id)}
                  className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400 hover:bg-emerald-500/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restaurar
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </Desplegable>
    </section>
  );
}
