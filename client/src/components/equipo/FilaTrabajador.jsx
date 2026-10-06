import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { esBackup } from '../../data/equipoRoles';
import { textosAgrupados } from '../../data/disponibilidad';

// Etiqueta pequeña de la fila: si no cabe, pasa a otra línea (cortada no se leía el horario).
// Las clases van completas para que Tailwind las detecte.
const TONOS = {
  amber: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  slate: 'bg-slate-800 text-slate-300 border-slate-700',
};
const Chip = ({ tono, children }) => (
  <span className={`inline-block max-w-full break-words rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-snug ${TONOS[tono]}`}>
    {children}
  </span>
);

const botonIcono = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-2';

// Una persona del equipo en «Gestionar equipo»: su icono, nombre, rol y lo que la
// ficha dice de ella (solo si hace falta, nómina, disponibilidad fija, nota), con
// editar (abre su ficha a todo el ancho) y quitar. Quitar pide confirmación en la propia fila.
//
// Props: trabajador, confirmando, onEditar, onQuitar, onConfirmarQuitar, onCancelarQuitar.
export default function FilaTrabajador({ trabajador: w, confirmando = false, onEditar, onQuitar, onConfirmarQuitar, onCancelarQuitar }) {
  const disponibilidad = textosAgrupados((w.disponibilidad || []).map(r => ({ ...r, persona: w.name, fija: true })), { conPersona: false });

  return (
    <li className={`rounded-2xl border transition-colors ${confirmando ? 'border-rose-500/40 bg-rose-500/5' : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'}`}>
      {/* Las etiquetas van en su propia fila, bajo el nombre y los botones: al lado del
          nombre, con tres columnas, no cabían y se cortaban. */}
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 p-2.5 sm:p-3">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-slate-800/80 text-xl">{w.avatar || '👤'}</span>

        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight text-white">{w.name}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{w.role || 'Sin rol'}</p>
        </div>

        {!confirmando && (
          <div className="flex shrink-0 items-center gap-0.5">
            {onEditar && (
              <button
                type="button"
                onClick={onEditar}
                aria-label={`Editar la ficha de ${w.name}`}
                title={`Editar la ficha de ${w.name}`}
                className={`${botonIcono} hover:bg-emerald-500/10 hover:text-emerald-300 focus-visible:ring-emerald-500/50`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={onQuitar}
              aria-label={`Quitar a ${w.name}`}
              title={`Quitar a ${w.name}`}
              className={`${botonIcono} hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-rose-500/50`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {(esBackup(w) || w.isPayroll || disponibilidad.length > 0 || w.nota) && (
          <div className="col-span-2 col-start-2 mt-1.5 flex flex-wrap gap-1">
            {esBackup(w) && <Chip tono="amber">Solo si hace falta</Chip>}
            {w.isPayroll && <Chip tono="indigo">Nómina</Chip>}
            {disponibilidad.map(t => <Chip key={t} tono="sky">{t}</Chip>)}
            {w.nota && <Chip tono="slate">{w.nota}</Chip>}
          </div>
        )}
      </div>

      {confirmando && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rose-500/20 px-3 py-2.5">
          <p className="text-xs text-rose-200">¿Quitar a {w.name} del equipo?</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancelarQuitar} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700">
              Cancelar
            </button>
            <button type="button" onClick={onConfirmarQuitar} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-rose-500">
              Sí, quitar
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
