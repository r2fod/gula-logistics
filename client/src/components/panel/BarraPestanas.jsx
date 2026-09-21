import React from 'react';
import { PESTANAS } from './pestanas';

// Barra de pestañas del panel (escritorio y tablet; en el móvil se desplaza en
// horizontal). Props: activa (id de la pestaña), onSeleccionar(id) y
// contadores ({ fichajes: 12 } añade "(12)" a la etiqueta de esa pestaña).
export default function BarraPestanas({ activa, onSeleccionar, contadores = {} }) {
  return (
    <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 sm:p-2 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar w-full max-w-full" role="tablist">
      {PESTANAS.map(({ id, etiqueta, icono: Icono, colorIcono = '', animacionIcono = '', colorActiva }) => {
        const seleccionada = activa === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={seleccionada}
            onClick={() => onSeleccionar(id)}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              seleccionada
                ? `${colorActiva} text-slate-950 font-extrabold shadow-lg`
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icono className={`w-3.5 h-3.5 ${colorIcono} ${animacionIcono}`.trim()} aria-hidden="true" />
            <span>{etiqueta}{contadores[id] !== undefined ? ` (${contadores[id]})` : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
