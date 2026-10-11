import React, { useMemo } from 'react';
import { PartyPopper } from 'lucide-react';
import { festivosDeLaSemana } from '../../data/festivosSemana';
import { useFestivosLocales } from '../../hooks/useFestivosLocales';

// Los festivos que caen en la semana (Cuadrante). Ese día cierran los proveedores y las
// empresas de alquiler: si hay una recogida o una devolución puesta, lo dice para que
// se pase a otro día. Sin festivos en la semana no pinta nada.
export default function AvisoFestivos({ semana }) {
  const locales = useFestivosLocales();
  const festivos = useMemo(() => festivosDeLaSemana(semana, locales), [semana, locales]);
  if (!festivos.length) return null;
  const hayRecados = festivos.some(f => f.tareas.length);

  return (
    <section
      aria-label="Festivos de la semana"
      className={`rounded-2xl border px-3.5 py-3 text-xs sm:text-sm ${hayRecados ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-900/60 text-slate-300'}`}
    >
      <h3 className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider ${hayRecados ? 'text-amber-300' : 'text-slate-400'}`}>
        <PartyPopper className="h-4 w-4 shrink-0" aria-hidden="true" />
        {festivos.length === 1 ? 'Festivo esta semana' : 'Festivos esta semana'}
      </h3>
      <ul className="mt-2 space-y-1.5">
        {festivos.map(f => (
          <li key={f.fecha} className="leading-snug">
            <b className="text-white">{f.etiqueta}</b> · {f.nombre}{f.previsto ? ' (previsto)' : ''}
            {f.tareas.length > 0 && (
              <span className="block text-amber-200">
                Cierran los proveedores y los alquileres. Pasa a otro día: {f.tareas.map(t => `«${t}»`).join(', ')}.
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
