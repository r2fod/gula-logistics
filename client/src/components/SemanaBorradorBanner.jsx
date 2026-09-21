import React from 'react';
import { Check, FilePenLine, RefreshCw } from 'lucide-react';

// Aviso de una semana en BORRADOR (propuesta generada desde el calendario,
// pendiente de que un admin la revise y la acepte).
export default function SemanaBorradorBanner({ week, adminUnlocked, onAceptar, onRegenerar }) {
  const avisos = week?.meta?.avisos || [];
  return (
    <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 sm:p-4 space-y-2.5">
      <p className="text-xs sm:text-sm font-extrabold text-amber-300"><FilePenLine className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Semana en BORRADOR — propuesta generada desde el calendario</p>
      <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
        Los horarios y quién hace qué son una propuesta. Revísala (Editar Planning) y, cuando esté bien, acéptala para activarla.
        Mientras sea borrador no es la semana por defecto de nadie y los trabajadores no la ven.
      </p>
      {avisos.length > 0 && (
        <ul className="text-[11px] text-amber-200 list-disc pl-4 space-y-0.5">
          {avisos.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
      {adminUnlocked ? (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={onAceptar} className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition-colors">
            <Check className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Aceptar y activar
          </button>
          {onRegenerar && (
            <button type="button" onClick={onRegenerar} className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Regenerar desde el calendario
            </button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500">Solo un administrador puede aceptarla.</p>
      )}
    </section>
  );
}
