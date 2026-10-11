import React from 'react';

// «Cargando…» centrado, para lo que se baja cuando hace falta (el panel, una pestaña).
// `children`: lo que deba verse detrás mientras tanto (p. ej. el fondo de la pestaña).
export default function Cargando({ texto = 'Cargando…', className = 'min-h-[40vh]', children = null }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 text-sm text-slate-400 ${className}`}>
      {children}
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400 motion-reduce:animate-none" aria-hidden="true" />
      {texto}
    </div>
  );
}
