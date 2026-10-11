import React from 'react';
import { Input } from '../ui/Campo';
import { splitEventNames } from '../../data/eventNaming';

// A qué evento (o eventos) pertenece una tarea del planning: de ahí sale el coste por
// evento. Los de la semana salen como botones —tocar uno lo añade o lo quita— y
// también se puede escribir; varios se guardan unidos con " + " ("Boda A + Boda B") y
// su coste se reparte entre ellos.
export default function CampoEvento({ valor = '', eventos = [], onCambiar, placeholder = 'Dejar vacío si es una Tarea General' }) {
  const elegidos = splitEventNames(valor);
  const botones = [...new Set([...eventos, ...elegidos])];
  const alternar = (nombre) => onCambiar((elegidos.includes(nombre) ? elegidos.filter(n => n !== nombre) : [...elegidos, nombre]).join(' + '));

  return (
    <div>
      <label className="text-[11px] text-slate-400 uppercase font-bold mb-1 block">Evento (Ej: Boda Ana y Luis) — si es de varios, sepáralos con +</label>
      <div className="relative">
        <div className="flex flex-nowrap overflow-x-auto gap-2 mb-2 w-full pb-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
          {botones.map((nombre) => {
            const puesto = elegidos.includes(nombre);
            return (
              <button
                key={nombre}
                type="button"
                aria-pressed={puesto}
                onClick={() => alternar(nombre)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-colors snap-start ${
                  puesto ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-900/80 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {nombre}
              </button>
            );
          })}
        </div>
        {/* Degradado a la derecha: hay más botones si se desliza. */}
        <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none rounded-r-lg"></div>
      </div>
      <Input
        type="text"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        placeholder={placeholder}
        aria-label="Evento"
        tamano="sm" redondeo="lg" texto="destacado"
      />
    </div>
  );
}
