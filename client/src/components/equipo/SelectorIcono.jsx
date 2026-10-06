import React from 'react';

// Iconos que se pueden poner a cada persona del equipo (al añadirla y en su ficha).
const ICONOS_EQUIPO = [
  ['📋', 'Logística'],
  ['🚚', 'Camión'],
  ['🚛', 'Tráiler'],
  ['🚐', 'Furgoneta'],
  ['📦', 'Almacén'],
  ['🛠️', 'Montaje'],
  ['🧹', 'Limpieza'],
  ['🍽️', 'Sala'],
  ['🍳', 'Cocina'],
  ['👤', 'Persona'],
];

// Elegir icono. Si alguien ya tiene uno que no está en la lista, sale el primero
// («Actual») para no perderlo al guardar otra cosa de su ficha.
export default function SelectorIcono({ valor, onCambiar }) {
  const opciones = !valor || ICONOS_EQUIPO.some(([emoji]) => emoji === valor) ? ICONOS_EQUIPO : [[valor, 'Actual'], ...ICONOS_EQUIPO];
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-300">Icono</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map(([emoji, texto]) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onCambiar(emoji)}
            aria-pressed={valor === emoji}
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${valor === emoji ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
          >
            <span aria-hidden="true" className="text-base leading-none">{emoji}</span>{texto}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
