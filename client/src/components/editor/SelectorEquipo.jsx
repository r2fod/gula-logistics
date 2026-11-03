import { useId, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Input } from '../ui/Campo';
import { useDialog } from '../../contexts/DialogContext';
import { mismoNombre } from '../../data/nombresTrabajadores';
import { tarifaDe } from '../../data/tarifas';

const ROL_INICIAL = 'Conductor Extra';

// Quién hace una tarea del editor: el equipo como botones que se marcan y, si llega
// `onAddWorker` (la MISMA función que usa «Gestionar equipo»: ficha de Saldos y equipo en
// Mongo), un botón «+ Nueva persona». Si ya hay alguien con ese nombre no se duplica: se
// avisa y se asigna a esa persona.
export default function SelectorEquipo({ equipo = [], asignados = [], onAlternar, onAddWorker = null }) {
  const { alert } = useDialog();
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState(ROL_INICIAL);
  const listaRoles = useId();
  const roles = [...new Set(equipo.map(w => w.role).filter(Boolean))];

  const cerrar = () => { setAbierto(false); setNombre(''); setRol(ROL_INICIAL); };
  const guardar = () => {
    const limpio = nombre.trim();
    if (!limpio) return;
    const existente = equipo.find(w => mismoNombre(w.name, limpio));
    if (existente) {
      alert(`Ya hay alguien llamado "${existente.name}" en el equipo: se asigna a la tarea sin crearlo otra vez.`, { type: 'warning' });
      if (!asignados.includes(existente.name)) onAlternar(existente.name);
    } else {
      onAddWorker({ name: limpio, role: rol.trim(), truck: 'No Asignado', avatar: '🚚', isPayroll: false, rate: tarifaDe({ isPayroll: false }) || undefined });
      onAlternar(limpio);
    }
    cerrar();
  };
  const alTeclear = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); guardar(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); }
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {equipo.map(w => {
          const marcado = asignados.includes(w.name);
          return (
            <button
              key={w.name}
              type="button"
              onClick={() => onAlternar(w.name)}
              className={`text-[11px] font-bold px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                marcado
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950 text-slate-400 border-slate-700/60 hover:border-slate-500 hover:bg-slate-900'
              }`}
            >
              <span className="shrink-0">{w.avatar}</span>
              <span className="truncate">{w.name}</span>
            </button>
          );
        })}
        {onAddWorker && !abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="text-[11px] font-bold px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-lg border border-dashed border-slate-600 text-slate-400 hover:border-amber-500/60 hover:text-amber-300 transition-colors flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">+ Nueva persona</span>
          </button>
        )}
      </div>
      {onAddWorker && abierto && (
        <div className="p-2 rounded-lg border border-slate-700/60 bg-slate-950/60 grid grid-cols-1 sm:grid-cols-2 gap-1.5" onKeyDown={alTeclear}>
          <Input type="text" tamano="xs" autoFocus value={nombre} placeholder="Nombre" aria-label="Nombre de la persona nueva" onChange={(e) => setNombre(e.target.value)} />
          <Input type="text" tamano="xs" list={listaRoles} value={rol} placeholder="Rol" aria-label="Rol de la persona nueva" onChange={(e) => setRol(e.target.value)} />
          <datalist id={listaRoles}>{roles.map(r => <option key={r} value={r} />)}</datalist>
          <div className="sm:col-span-2 flex justify-end gap-1.5">
            <button type="button" onClick={cerrar} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Cancelar</button>
            <button type="button" onClick={guardar} disabled={!nombre.trim()} className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 disabled:opacity-40">Añadir persona</button>
          </div>
        </div>
      )}
    </div>
  );
}
