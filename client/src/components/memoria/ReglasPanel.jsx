import React, { useState } from 'react';
import { Check, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useDialog } from '../../contexts/DialogContext';
import { Input } from '../ui/Campo';

// Reglas a largo plazo de Gemini: las que ha propuesto el asistente (esperan a
// que el admin las apruebe), las activas (entran en todos los prompts) y un
// campo para escribir una a mano. `memoria` es lo que devuelve useMemoriaIa.
export default function ReglasPanel({ memoria }) {
  const { confirm } = useDialog();
  const [nueva, setNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  const { activas, propuestas, cargando } = memoria;

  const anadir = async (e) => {
    e.preventDefault();
    if (!nueva.trim()) return;
    setGuardando(true);
    if (await memoria.anadir(nueva)) setNueva('');
    setGuardando(false);
  };

  const borrar = async (regla) => {
    if (await confirm(`Gemini dejará de tener en cuenta: «${regla.content}». ¿Borrarla?`, { type: 'warning', confirmText: 'Borrar' })) {
      await memoria.descartar(regla._id);
    }
  };

  const numero = (regla) => memoria.memorias.indexOf(regla) + 1; // el mismo R# que en el grafo

  return (
    <div className="space-y-4">
      {propuestas.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-300">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Propuestas del asistente ({propuestas.length})
          </h3>
          <p className="text-xs text-slate-400">Sacadas de lo que le has pedido. No las usa hasta que las apruebes.</p>
          <ul className="space-y-2">
            {propuestas.map(r => (
              <li key={r._id} className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950 p-3 sm:flex-row sm:items-center animate-aparecer motion-reduce:animate-none">
                <span className="flex-1 text-sm text-slate-200"><span className="mr-1.5 text-[11px] font-bold text-slate-500">R{numero(r)}</span>{r.content}</span>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => memoria.aprobar(r._id)} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Aprobar
                  </button>
                  <button type="button" onClick={() => memoria.descartar(r._id)} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-rose-500/50 hover:text-rose-300">
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Descartar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={anadir} className="flex gap-2">
        <Input
          id="nueva-regla-ia"
          aria-label="Nueva regla para el asistente"
          className="flex-1"
          placeholder="Ej.: las bodas de más de 200 pax llevan un apoyo más en la carga"
          value={nueva}
          maxLength={300}
          onChange={(e) => setNueva(e.target.value)}
        />
        <button type="submit" disabled={guardando || !nueva.trim()} aria-label="Añadir regla" className="grid w-11 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-50">
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Reglas que usa Gemini ({activas.length})</h3>
        {cargando ? (
          <p className="text-xs text-slate-500">Cargando…</p>
        ) : activas.length === 0 ? (
          <p className="text-xs text-slate-500">Ninguna todavía. Escríbelas arriba o apruébalas cuando el asistente las proponga.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {activas.map(r => (
              <li key={r._id} className="group flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <span className="text-sm text-slate-300"><span className="mr-1.5 text-[11px] font-bold text-slate-500">R{numero(r)}</span>{r.content}</span>
                <button type="button" onClick={() => borrar(r)} aria-label={`Borrar la regla R${numero(r)}`} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
