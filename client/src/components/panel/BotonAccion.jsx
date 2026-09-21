import React from 'react';

// Estilo de cada tono en cada variante. Las clases van completas para que
// Tailwind las detecte. Si un tono no define una variante, se usa la de 'barra'.
const ESTILOS = {
  fichar: {
    barra: 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 active:from-emerald-400 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20 active:scale-95',
    menu: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 font-extrabold shadow-md',
  },
  aviso: {
    barra: 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold border border-indigo-500/30',
    menu: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30',
  },
  planning: {
    barra: 'bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 font-bold border border-orange-500/30',
    menu: 'bg-slate-950 hover:bg-slate-800 text-orange-400 font-bold border border-slate-800',
  },
  equipo: {
    barra: 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold border border-indigo-500/30',
    menu: 'bg-slate-950 hover:bg-slate-800 text-indigo-300 font-bold border border-slate-800',
  },
  neutro: {
    barra: 'bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold border border-slate-800',
    menu: 'bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold border border-slate-800',
  },
  gemini: {
    barra: 'bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold shadow-md active:scale-95',
    menu: 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 text-amber-300 font-extrabold border border-amber-500/30',
  },
  whatsapp: {
    barra: 'bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-600/30 active:scale-95',
    movil: 'bg-blue-600/20 active:bg-blue-600/40 text-blue-300 font-bold border border-blue-500/30',
    menu: 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-bold border border-blue-500/30',
  },
  enlace: {
    barra: 'bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold border border-amber-500/30',
    menu: 'bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold border border-slate-800',
  },
  publica: {
    barra: 'bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold border border-amber-500/30',
    menu: 'bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold border border-slate-800',
  },
  claves: {
    cabecera: 'px-1.5 py-0.5 text-[9px] rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold border border-slate-700 gap-1',
    menu: 'bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold border border-slate-800',
  },
  semana: {
    cabecera: 'bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold px-2.5 py-1.5 rounded-xl text-xs border border-slate-800 gap-1',
    menu: 'bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold border border-slate-800',
  },
};

// Lo común de cada variante (tamaño, alineación, transición).
const BASE = {
  barra: 'px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shrink-0',
  movil: 'px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all shrink-0',
  menu: 'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs',
  cabecera: 'flex items-center transition-colors shrink-0',
};

// Tamaño del icono en cada variante.
const ICONO = { barra: 'w-3.5 h-3.5', movil: 'w-3.5 h-3.5', menu: 'w-4 h-4', cabecera: 'w-3 h-3' };

// Pinta una acción de `crearAcciones` (acciones.js) como botón.
//
// - accion: la acción.
// - variante: 'barra' | 'movil' | 'menu' | 'cabecera'.
// - alPulsar: se llama tras `accion.onClick` (el menú lateral lo usa para cerrarse).
export default function BotonAccion({ accion, variante = 'barra', alPulsar }) {
  const { icono: Icono, etiqueta, etiquetaMenu, cargando, titulo, tono } = accion;
  const estilos = ESTILOS[tono] || ESTILOS.neutro;
  const claseTono = estilos[variante] || estilos.barra;
  // Los botones de la barra de escritorio y el iniciar/avisar tienen animación en reposo;
  // en el resto solo late el icono mientras trabaja.
  const animacion = cargando ? 'animate-pulse' : (variante === 'barra' ? accion.animacionIcono || '' : '');
  const texto = variante === 'menu' ? etiquetaMenu || etiqueta : etiqueta;

  return (
    <button
      type="button"
      onClick={() => {
        accion.onClick?.();
        alPulsar?.();
      }}
      disabled={cargando}
      title={variante === 'menu' ? undefined : titulo}
      className={`${BASE[variante]} ${claseTono}`}
    >
      <Icono className={`${ICONO[variante]} shrink-0 ${accion.colorIcono || ''} ${animacion}`.trim()} aria-hidden="true" />
      <span className={variante === 'barra' || variante === 'cabecera' ? 'whitespace-nowrap truncate max-w-[120px]' : 'whitespace-nowrap'}>{texto}</span>
    </button>
  );
}
