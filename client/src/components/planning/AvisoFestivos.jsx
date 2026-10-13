import React, { useMemo, useState } from 'react';
import { ArrowRight, PartyPopper } from 'lucide-react';
import { festivosDeLaSemana } from '../../data/festivosSemana';
import { useFestivosLocales } from '../../hooks/useFestivosLocales';
import { useDialog } from '../../contexts/DialogContext';

// Los festivos que caen en la semana (Cuadrante). Ese día cierran los proveedores y las
// empresas de alquiler: si hay una recogida o una devolución puesta, lo dice y —con
// `onPasar(dia, indice)`, solo el admin— la pasa con un toque al día que abren (la
// devolución, al siguiente; la recogida, al anterior), aunque sea de otra semana.
// `onPasar` devuelve { destino, semana } o { error }. Sin festivos no pinta nada.
export default function AvisoFestivos({ semana, onPasar = null }) {
  const { alert, confirm } = useDialog();
  const locales = useFestivosLocales();
  const [moviendo, setMoviendo] = useState(false);
  const festivos = useMemo(() => festivosDeLaSemana(semana, locales), [semana, locales]);
  if (!festivos.length) return null;
  const hayRecados = festivos.some(f => f.recados.length);

  const pasar = async (festivo, recado) => {
    if (!(await confirm(`«${recado.texto}» pasará al ${recado.destino} (ahora está el ${festivo.etiqueta.toLowerCase()}, festivo). Conserva su gente y su horario.`, { title: 'Pasar a un día que abren', confirmText: `Pasar al ${recado.destino}` }))) return;
    setMoviendo(true);
    const r = await onPasar(festivo.dia, recado.indice);
    setMoviendo(false);
    if (r?.error) await alert(r.error, { type: 'warning' });
    else if (r?.destino) await alert(`Hecho: «${recado.texto}» está ahora el ${r.destino}${r.semana ? ` (${r.semana})` : ''}.`, { type: 'success' });
  };

  return (
    <section
      aria-label="Festivos de la semana"
      className={`rounded-2xl border px-3.5 py-3 text-xs sm:text-sm ${hayRecados ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-900/60 text-slate-300'}`}
    >
      <h3 className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider ${hayRecados ? 'text-amber-300' : 'text-slate-400'}`}>
        <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
        {festivos.length === 1 ? 'Festivo esta semana' : 'Festivos esta semana'}
      </h3>
      <ul className="mt-2 space-y-2">
        {festivos.map(f => (
          <li key={f.fecha} className="leading-snug">
            <b className="text-white">{f.etiqueta}</b> · {f.nombre}{f.previsto ? ' (previsto)' : ''}
            {f.recados.length > 0 && (
              <>
                <span className="block text-amber-200">Cierran los proveedores y los alquileres. Pasa a otro día:</span>
                <ul className="mt-1.5 space-y-1.5">
                  {f.recados.map(r => (
                    <li key={r.indice} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-slate-950/40 px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 basis-40 font-semibold text-white">«{r.texto}»</span>
                      {onPasar && (
                        <button
                          type="button"
                          disabled={moviendo}
                          onClick={() => pasar(f, r)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-100 transition-colors hover:bg-amber-500/30 disabled:opacity-50"
                        >
                          Pasar al {r.destino} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
