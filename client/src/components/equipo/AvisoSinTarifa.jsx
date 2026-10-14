import { AlertTriangle } from 'lucide-react';
import { sinTarifa } from '../../data/tarifasPorDefecto';

// Solo el admin. Quien no tiene tarifa (ni la suya ni la por defecto de la base) sale a
// 0 € en horas, saldos y resumen: se avisa arriba en vez de dejarlo pasar. Las tarifas ya
// no se inventan en el código, así que sin dato hay que ponerlo (Gestionar equipo).
export default function AvisoSinTarifa({ equipo = [], onAbrirEquipo = null }) {
  const sin = sinTarifa(equipo);
  if (!sin.length) return null;
  return (
    <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[11px] sm:text-xs text-amber-200">
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
        <span>Sin tarifa por hora: {sin.map(w => w.name).join(', ')}. Sus horas salen a 0 € hasta que pongas la suya en su ficha o la por defecto del equipo.</span>
      </span>
      {onAbrirEquipo && (
        <button type="button" onClick={onAbrirEquipo} className="shrink-0 rounded-lg bg-amber-500/20 px-2.5 py-1.5 font-bold text-amber-100 hover:bg-amber-500/30">
          Gestionar equipo
        </button>
      )}
    </div>
  );
}
