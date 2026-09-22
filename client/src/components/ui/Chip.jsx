import React from 'react';

const VARIANTES_SELECCIONADO = {
  amber: 'bg-amber-500/20 text-amber-400 border-amber-500/40 ring-1 ring-amber-500/40 shadow-md shadow-amber-500/10',
  indigo: 'bg-indigo-500/20 text-indigo-300 border-indigo-500 ring-1 ring-indigo-500/40 shadow-md shadow-indigo-500/10'
};

// Componente para botones seleccionables tipo "píldora" o bloque,
// usados para elegir nombres, eventos o tags múltiples.
export default function Chip({ 
  children, 
  seleccionado = false, 
  onClick, 
  variante = 'amber', 
  className = '' 
}) {
  const baseClasses = 'flex items-center justify-center gap-1.5 px-3 py-1.5 sm:p-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all border cursor-pointer';
  const noSeleccionadoClasses = 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300 hover:bg-slate-800/50';
  
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={seleccionado}
      className={`${baseClasses} ${seleccionado ? (VARIANTES_SELECCIONADO[variante] || VARIANTES_SELECCIONADO.amber) : noSeleccionadoClasses} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
