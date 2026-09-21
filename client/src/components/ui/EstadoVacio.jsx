import React from 'react';

// Mensaje de "no hay nada que enseñar" con un icono grande: listas de fichajes,
// papelera, horas estimadas... Props: icono (lucide), titulo, detalle (opcional),
// className (relleno vertical y fondo si no son los de por defecto) y
// tituloDestacado (título más grande y claro, para pestañas enteras).
export default function EstadoVacio({ icono: Icono, titulo, detalle = null, colorIcono = 'text-slate-500', tituloDestacado = false, className = 'py-12 bg-slate-950/40' }) {
  return (
    <div className={`text-center rounded-2xl border border-slate-800 ${className}`}>
      <Icono className={`w-8 h-8 mx-auto mb-2 ${colorIcono}`} aria-hidden="true" />
      <p className={tituloDestacado ? 'text-sm font-semibold text-slate-300' : 'text-xs text-slate-400'}>{titulo}</p>
      {detalle && <p className={`${tituloDestacado ? 'text-xs text-slate-500' : 'text-[11px] text-slate-500'} mt-1`}>{detalle}</p>}
    </div>
  );
}
