import { useState } from 'react';
import { Selector, Input } from '../ui/Campo';
import { camionesParaElegir } from '../../data/flota';
import { plano } from '../../utils/texto';

const NUEVO = '__nuevo_vehiculo__';

// El camión de una tarea del editor: los de la flota de la semana (ver data/flota.js) y,
// si llega `onAnadirVehiculo(nombre)`, una última opción para dar de alta uno nuevo sin salir
// del editor. Si ya está en la flota (mismo texto sin tildes ni mayúsculas) se elige ese.
export default function SelectorCamion({ valor = '', flota = [], onCambiar, onAnadirVehiculo = null, acento }) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [nombre, setNombre] = useState('');

  const cerrar = () => { setAnadiendo(false); setNombre(''); };
  const anadir = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const existente = camionesParaElegir(flota, valor).find(c => plano(c) === plano(limpio));
    if (existente) onCambiar(existente);
    else { onAnadirVehiculo(limpio); onCambiar(limpio); }
    cerrar();
  };

  if (anadiendo) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          type="text" tamano="xs" acento={acento} autoFocus value={nombre} placeholder="Nombre del vehículo"
          aria-label="Nombre del vehículo nuevo" className="flex-1 min-w-[8rem]"
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); anadir(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
          }}
        />
        <button type="button" onClick={anadir} disabled={!nombre.trim()} className="text-[11px] font-bold px-2.5 py-2 rounded-lg bg-amber-500 text-slate-950 disabled:opacity-40">Añadir</button>
        <button type="button" onClick={cerrar} className="text-[11px] font-bold px-2.5 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</button>
      </div>
    );
  }

  return (
    <Selector
      value={valor}
      onChange={(e) => (e.target.value === NUEVO ? setAnadiendo(true) : onCambiar(e.target.value))}
      tamano="xs" acento={acento} texto="suave"
    >
      <option value="">Sin camión / no aplica</option>
      {camionesParaElegir(flota, valor).map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
      {onAnadirVehiculo && <option value={NUEVO}>+ Añadir vehículo…</option>}
    </Selector>
  );
}
