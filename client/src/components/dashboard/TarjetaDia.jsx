import React from 'react';
import { Calendar } from 'lucide-react';

// Tarjeta de un día del Cuadrante: cabecera con la fecha y una insignia, y el contenido
// debajo. Es la misma para los días de la semana y para el lunes de la víspera, así
// se ven y se marcan igual.
export default function TarjetaDia({ titulo, insignia = null, colorInsignia = 'text-amber-300', className = '', children }) {
  return (
    <div className={`bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4 ${className}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800/80">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
            <Calendar className="text-amber-400 w-4 h-4" /> {titulo}
          </h3>
          {insignia && (
            <span className={`text-[10px] bg-slate-950 ${colorInsignia} font-bold px-2.5 py-1 rounded-xl border border-slate-800`}>
              {insignia}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
