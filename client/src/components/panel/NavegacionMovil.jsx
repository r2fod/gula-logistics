import React from 'react';
import { Menu } from 'lucide-react';
import { PESTANAS } from './pestanas';

// Barra inferior del móvil y la tablet, al alcance del pulgar: las pestañas
// principales (las que tienen `etiquetaCorta`) y el botón del menú lateral.
// Props: activa (id de la pestaña), onSeleccionar(id) y onAbrirMenu.
export default function NavegacionMovil({ activa, onSeleccionar, onAbrirMenu }) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl safe-bottom">
      {PESTANAS.filter((p) => p.etiquetaCorta).map(({ id, etiquetaCorta, icono: Icono, colorIcono = '', animacionIcono = '', colorTextoMovil }) => {
        const seleccionada = activa === id;
        return (
          <button
            key={id}
            onClick={() => onSeleccionar(id)}
            aria-current={seleccionada ? 'page' : undefined}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
              seleccionada ? `${colorTextoMovil} font-extrabold scale-105` : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icono className={`w-5 h-5 mb-0.5 ${colorIcono} ${animacionIcono}`.trim()} aria-hidden="true" />
            <span className="text-[10px]">{etiquetaCorta}</span>
          </button>
        );
      })}

      <button
        onClick={onAbrirMenu}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-amber-400 transition-all"
      >
        <Menu className="w-5 h-5 mb-0.5" aria-hidden="true" />
        <span className="text-[10px]">Menú</span>
      </button>
    </nav>
  );
}
