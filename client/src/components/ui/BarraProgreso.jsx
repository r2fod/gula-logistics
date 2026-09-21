import React from 'react';

// Barra de progreso: una pista redondeada con un relleno que crece hasta `porcentaje`.
// El porcentaje se acota a 0-100 (un valor raro como NaN o 130 no descuadra la barra).
//
// - porcentaje: 0-100.
// - pista: clases de la pista (alto, fondo, borde, relleno interior).
// - relleno: clases del relleno (color o degradado y su transición).
// - etiqueta: nombre accesible de la barra ("Progreso de tareas").
export default function BarraProgreso({ porcentaje, pista = 'h-2.5 bg-slate-950 border border-slate-800', relleno = 'bg-emerald-500 transition-all duration-500', etiqueta }) {
  const valor = Number.isFinite(porcentaje) ? Math.min(100, Math.max(0, porcentaje)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
      className={`w-full rounded-full overflow-hidden ${pista}`}
    >
      <div className={`h-full rounded-full ${relleno}`} style={{ width: `${valor}%` }} />
    </div>
  );
}
