import React from 'react';

// Cajas de icono: "suave" (fondo tintado) o "degradado" (anillo de color).
const SUAVES = {
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  slate: 'bg-slate-800 border-slate-700 text-white',
};

const DEGRADADOS = {
  'amber-indigo': { anillo: 'from-amber-500 to-indigo-500 shadow-lg shadow-amber-500/20', icono: 'text-amber-400' },
  'amber-orange': { anillo: 'from-amber-500 to-orange-500 shadow-lg', icono: 'text-amber-400' },
  'emerald-teal': { anillo: 'from-emerald-500 to-teal-500 shadow-lg', icono: 'text-emerald-400' },
};

// Cabecera de un modal: caja con icono, título, subtítulo y, opcionalmente, una
// insignia junto al título y acciones a la derecha.
//
// Props:
// - icono: componente de lucide-react.
// - titulo / subtitulo: texto (el subtítulo admite JSX).
// - tono: 'amber' | 'emerald' | 'blue' | 'slate' (caja tintada). Ignorado si hay `degradado`.
// - degradado: 'amber-indigo' | 'amber-orange' | 'emerald-teal' (caja con anillo de color).
// - insignia: nodo que se pinta a la derecha del título (p. ej. "ADMIN ONLY").
// - acciones: nodo pegado al extremo derecho de la cabecera.
// - compacta: caja y textos más pequeños en móvil.
// - className: márgenes del bloque (p. ej. "mb-6").
export default function CabeceraModal({
  icono: Icono,
  titulo,
  subtitulo = null,
  tono = 'amber',
  degradado = null,
  insignia = null,
  acciones = null,
  compacta = false,
  className = '',
}) {
  const tamanoCaja = compacta ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12';
  const tamanoIcono = compacta ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-6 h-6';
  const grad = degradado ? DEGRADADOS[degradado] : null;

  const caja = grad ? (
    <div className={`${tamanoCaja} shrink-0 rounded-2xl bg-gradient-to-tr ${grad.anillo} p-0.5`}>
      <div className={`w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center ${grad.icono}`}>
        <Icono className={tamanoIcono} aria-hidden="true" />
      </div>
    </div>
  ) : (
    <div className={`${tamanoCaja} shrink-0 rounded-2xl border flex items-center justify-center ${SUAVES[tono] || SUAVES.amber}`}>
      <Icono className={tamanoIcono} aria-hidden="true" />
    </div>
  );

  const bloque = (
    <div className="flex items-center space-x-3 min-w-0">
      {caja}
      <div className="min-w-0">
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
          <h3 className={`${compacta ? 'text-lg sm:text-xl' : 'text-xl'} font-bold font-['Outfit']`}>{titulo}</h3>
          {insignia}
        </div>
        {subtitulo && <p className={`${compacta ? 'text-[11px] sm:text-xs' : 'text-xs'} text-slate-400`}>{subtitulo}</p>}
      </div>
    </div>
  );

  if (!acciones) return <div className={className}>{bloque}</div>;

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {bloque}
      {acciones}
    </div>
  );
}
