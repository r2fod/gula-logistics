import React from 'react';

// Las clases van completas para que Tailwind las detecte.
const VARIANTES = {
  // Panel grande de una pestaña.
  panel: 'bg-slate-900 border border-slate-800 rounded-3xl shadow-xl',
  // Recuadro oscuro dentro de otro panel (una boda, un evento, una fila de formulario).
  recuadro: 'bg-slate-950 border border-slate-800 rounded-2xl',
  // Como el recuadro pero más tenue: filas de listas y estados vacíos.
  suave: 'bg-slate-950/60 border border-slate-800 rounded-2xl',
  // Lienzo de una vista grande (el grafo).
  lienzo: 'bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl',
};

// Superficie base de la interfaz: fondo, borde y esquinas. El relleno, la
// separación y las animaciones los pone quien la usa con `className`.
// Props: variante ('panel' | 'recuadro' | 'suave' | 'lienzo'), as (etiqueta HTML,
// por defecto div), className y el resto se pasa al elemento.
export default function Tarjeta({ variante = 'recuadro', as: Etiqueta = 'div', className = '', children, ...resto }) {
  return (
    <Etiqueta className={`${VARIANTES[variante] || VARIANTES.recuadro} ${className}`.trim()} {...resto}>
      {children}
    </Etiqueta>
  );
}
