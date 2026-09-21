import React from 'react';
import { X } from 'lucide-react';

// Botón "X" de los modales. Props: `onClick`, `className` (posición, p. ej.
// "absolute top-5 right-5") y `etiqueta` (texto accesible, por defecto "Cerrar").
export default function BotonCerrar({ onClick, className = '', etiqueta = 'Cerrar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${className}`}
    >
      <X className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}
