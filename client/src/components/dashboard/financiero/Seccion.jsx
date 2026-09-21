import React from 'react';

// Tarjeta de sección del Resumen Financiero: cabecera con icono, título y una
// línea de apoyo, y el contenido debajo. `min-w-0` deja que el contenido
// (tablas, gráficas) se encoja en vez de ensanchar la página en móvil.
export default function Seccion({ titulo, subtitulo = null, icono: Icono = null, color = 'text-amber-400', retraso = 0, className = '', children }) {
  return (
    <section
      className={`flex flex-col min-w-0 overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-lg animate-aparecer motion-reduce:animate-none ${className}`}
      style={{ animationDelay: `${retraso}ms` }}
    >
      <header className="flex items-center gap-2.5 px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-slate-800 bg-slate-900/80">
        {Icono && <Icono className={`h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />}
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-200 leading-tight">{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{subtitulo}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
