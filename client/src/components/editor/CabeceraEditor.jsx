import { Edit3, Truck, Users } from 'lucide-react';
import CabeceraModal from '../ui/CabeceraModal';
import BotonCerrar from '../ui/BotonCerrar';
import Boton from '../ui/Boton';

// Cabecera del editor del planning con los atajos a la flota y al equipo: se cambian
// vehículos y personas sin salir del editor. Cada atajo sale solo si llega su función.
export default function CabeceraEditor({ nombreSemana, onCerrar, onFlota = null, onEquipo = null }) {
  const atajo = 'px-2.5 py-1.5 text-xs';
  return (
    <CabeceraModal
      icono={Edit3}
      degradado="amber-orange"
      compacta
      titulo="Editor Manual del Planning"
      subtitulo={`Modificando: ${nombreSemana || 'Semana'}`}
      acciones={(
        <div className="flex items-center gap-1.5">
          {onFlota && (
            <Boton onClick={onFlota} className={atajo} aria-label="Gestionar la flota de esta semana" title="Gestionar la flota de esta semana">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">Flota</span>
            </Boton>
          )}
          {onEquipo && (
            <Boton onClick={onEquipo} className={atajo} aria-label="Gestionar el equipo" title="Gestionar el equipo">
              <Users className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">Equipo</span>
            </Boton>
          )}
          {/* La X va como acción: así el título no reserva sitio de más y cabe en una línea en el móvil. */}
          <BotonCerrar onClick={onCerrar} />
        </div>
      )}
    />
  );
}
