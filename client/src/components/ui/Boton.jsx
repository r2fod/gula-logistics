import React from 'react';

// Variantes base de botones en la interfaz de Gula Logistics.
// El tamaño, padding exacto y margen se puede sobreescribir con className.
const VARIANTES = {
  // El botón principal de Guardar o Acción principal (ámbar/naranja).
  primario: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 shadow-lg shadow-amber-500/20 border-0',
  // Botones de cancelar o acciones secundarias.
  secundario: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700',
  // Botones de eliminar o rechazar.
  peligro: 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 border-0',
  // Botón de Enviar Aviso u otras acciones destacadas.
  indigo: 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20 border-0',
  // Botones para añadir elementos al final de listas.
  dashed: 'bg-transparent border border-dashed border-emerald-900/60 hover:border-emerald-500/60 text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/5',
  // Botones pequeños de acción en listas.
  fantasmaPeligro: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
};

// Componente estándar para botones unificando comportamiento y diseño base.
export default function Boton({ 
  variante = 'secundario', 
  tipo = 'button', 
  className = '', 
  disabled = false, 
  children, 
  ...resto 
}) {
  return (
    <button
      type={tipo}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTES[variante] || VARIANTES.secundario} ${className}`.trim()}
      {...resto}
    >
      {children}
    </button>
  );
}
