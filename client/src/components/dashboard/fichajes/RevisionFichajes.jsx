import React, { useState } from 'react';
import { Check, ChevronDown, ClipboardCheck, Pencil, Trash2 } from 'lucide-react';
import Desplegable from '../../ui/Desplegable';
import { fechaDeFichaje, horaDeFichaje } from '../../../data/fichajes';
import { useDialog } from '../../../contexts/DialogContext';

const cuando = (fichajes) => {
  const [primero] = fichajes;
  const ultimo = fichajes[fichajes.length - 1];
  return `${fechaDeFichaje(primero)} ${horaDeFichaje(primero)}${ultimo !== primero ? ` → ${horaDeFichaje(ultimo)}` : ''}`;
};

const botonFila = 'flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold';

// Lo que encuentra revisarFichajes (solo admin). Sin nada que enseñar, no se pinta.
// - Para revisar: turnos de más de 14 h (o abiertos hace más de 12 h), que cuentan enteros: se corrigen con «Editar»
//   o se dan por buenos con «Está bien» (y dejan de avisar).
// - Sobran: no cuentan horas ni dinero: «A la papelera», uno a uno o todos.
export default function RevisionFichajes({ revision, onEditar, onMarcarRevisado, onMoverAPapelera }) {
  const { confirm } = useDialog();
  const { sobran, revisar } = revision;
  const [abierta, setAbierta] = useState(revisar.length > 0);
  if (!sobran.length && !revisar.length) return null;

  const idsQueSobran = sobran.flatMap(g => g.fichajes.map(e => e.id));
  const moverTodos = async () => {
    const n = idsQueSobran.length;
    if (await confirm(`Se moverán a la papelera ${n === 1 ? '1 fichaje que no cuenta' : `${n} fichajes que no cuentan`} en horas ni en saldos. Podrás restaurarlos desde la Papelera hasta que la vacíes.`, { type: 'warning', title: 'Limpiar fichajes', confirmText: 'Mover a la papelera' })) {
      onMoverAPapelera(idsQueSobran);
    }
  };

  return (
    <section className={`rounded-2xl border ${revisar.length ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-900/60'}`}>
      <button
        type="button"
        onClick={() => setAbierta(a => !a)}
        aria-expanded={abierta}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500/60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <ClipboardCheck className={`h-4 w-4 ${revisar.length ? 'text-amber-400' : 'text-slate-400'}`} aria-hidden="true" />
          Revisión de fichajes
        </span>
        <span className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
          {revisar.length > 0 && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">{revisar.length} para revisar</span>}
          {sobran.length > 0 && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{idsQueSobran.length} sobran</span>}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 text-slate-500 transition-transform duration-300 motion-reduce:transition-none ${abierta ? 'rotate-180' : ''}`} />
        </span>
      </button>

      <Desplegable abierto={abierta}>
        <div className="space-y-4 border-t border-slate-800 px-4 py-3">
          {revisar.length > 0 && (
            <div>
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">Turnos muy largos</h4>
              <p className="mt-0.5 text-[11px] text-slate-400">Se pagan enteros. Si alguien se olvidó de fichar la salida, corrígelo; si fue así, dalo por bueno.</p>
              <ul className="mt-2 divide-y divide-slate-800/70">
                {revisar.map(g => {
                  const [entrada, salida] = g.fichajes;
                  return (
                    <li key={entrada.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                      <span className="min-w-0 flex-1 basis-56">
                        <b className="text-slate-100">{g.persona}</b> <span className="tabular-nums text-slate-400">{cuando(g.fichajes)}</span>
                        <span className="block text-slate-300">{g.detalle}</span>
                        {!salida && <span className="block text-[11px] text-slate-500">Si se olvidó, añádele la salida con «Añadir fichaje manual».</span>}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        <button type="button" onClick={() => onEditar(salida || entrada)} className={`${botonFila} border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700`}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> {salida ? 'Editar salida' : 'Editar entrada'}
                        </button>
                        <button type="button" onClick={() => onMarcarRevisado(entrada)} className={`${botonFila} border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}>
                          <Check className="h-3.5 w-3.5" aria-hidden="true" /> Está bien
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {sobran.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1 basis-56">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-300">Sobran</h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">La app ya no los cuenta (ni horas ni dinero): quitarlos no cambia ninguna cuenta.</p>
                </div>
                <button type="button" onClick={moverTodos} className={`${botonFila} shrink-0 border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Mover {idsQueSobran.length === 1 ? 'el fichaje' : `los ${idsQueSobran.length}`} a la papelera
                </button>
              </div>
              <ul className="mt-2 divide-y divide-slate-800/70">
                {sobran.map(g => (
                  <li key={g.fichajes[0].id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 basis-56">
                      <b className="text-slate-100">{g.persona}</b> <span className="tabular-nums text-slate-400">{cuando(g.fichajes)}</span>
                      <span className="block text-slate-400">{g.detalle}</span>
                    </span>
                    <button type="button" onClick={() => onMoverAPapelera(g.fichajes.map(e => e.id))} className={`${botonFila} shrink-0 border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700`}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> A la papelera
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Desplegable>
    </section>
  );
}
