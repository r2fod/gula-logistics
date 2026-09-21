import React from 'react';

// Bloque que se abre y se cierra con una transición de altura (grid-template-rows,
// sin medir nada en JS). Cerrado queda `invisible`: no se puede tabular a lo que
// hay dentro ni lo lee un lector de pantalla, y la visibilidad cambia al terminar
// la transición para que el cierre se vea entero.
export default function Desplegable({ abierto, className = '', children }) {
  return (
    <div
      className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out motion-reduce:transition-none ${
        abierto ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible'
      } ${className}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
