import React from 'react';

// Reemplazo visual para los emojis 🟢 🔴 ⚪ usando CSS puro y sombras para dar un aspecto brillante y profesional.
export default function PuntoEstado({ color = 'verde', className = '' }) {
  const colores = {
    verde: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    rojo: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
    gris: 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.3)]',
    ambar: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
  };

  return (
    <span 
      className={`inline-block w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shrink-0 ${colores[color] || colores.gris} ${className}`.trim()} 
      aria-hidden="true"
    />
  );
}
