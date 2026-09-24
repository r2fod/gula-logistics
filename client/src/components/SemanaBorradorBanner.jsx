import React from 'react';
import { Check, FilePenLine, RefreshCw } from 'lucide-react';

// Aviso de una semana en BORRADOR (propuesta generada desde el calendario,
// pendiente de que un admin la revise y la acepte).
export default function SemanaBorradorBanner({ week, adminUnlocked, onAceptar, onRegenerar, onEliminar }) {
  const avisos = week?.meta?.avisos || [];
  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-slate-900/40 p-5 sm:p-6 shadow-2xl backdrop-blur-xl group">
      {/* Premium glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5 opacity-50 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="relative z-10 space-y-3">
        <p className="text-sm sm:text-base font-extrabold text-amber-400 flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <FilePenLine className="w-4 h-4" aria-hidden="true" />
          </span>
          Semana en BORRADOR — propuesta del calendario
        </p>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Los horarios y quién hace qué son una propuesta generada. Revísala en el Editor y, cuando esté lista, acéptala para activarla. 
          Mientras sea borrador, no será visible para el equipo.
        </p>
      {avisos.length > 0 && (
        <ul className="text-[11px] text-amber-200 list-disc pl-4 space-y-0.5">
          {avisos.map((a, i) => <li key={i}>{a}</li>)}
        </ul>
      )}
      {adminUnlocked ? (
        <div className="flex flex-wrap gap-3 pt-3 mt-4 border-t border-slate-800/60">
          <button type="button" onClick={onAceptar} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:opacity-90 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all hover:scale-105">
            <Check className="w-4 h-4" aria-hidden="true" /> Aceptar y activar
          </button>
          {onRegenerar && (
            <button type="button" onClick={onRegenerar} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-lg shadow-black/20 transition-all hover:scale-105">
              <RefreshCw className="w-4 h-4" aria-hidden="true" /> Regenerar desde el calendario
            </button>
          )}
          {onEliminar && (
            <button type="button" onClick={onEliminar} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 text-xs font-bold border border-red-900/50 transition-all hover:scale-105">
              ✕ Descartar borrador
            </button>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 mt-2">Solo un administrador puede aceptarla o borrarla.</p>
      )}
      </div>
    </section>
  );
}
