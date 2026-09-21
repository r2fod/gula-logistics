import React, { useState } from 'react';
import { Users, Save, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input, Selector } from './ui/Campo';

export default function AdminWorkerEditorModal({ isOpen, onClose, workersList = [], onAddWorker, onRemoveWorker }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Conductor Extra');
  const [avatar, setAvatar] = useState('🚚');
  const [confirmRemove, setConfirmRemove] = useState(null); // nombre pendiente de confirmar

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Sin esto, dos personas con el mismo nombre (o un reintento tras una
    // errata) generan dos entradas — su id de saldo en Mongo se deriva del
    // nombre (name.toLowerCase().replace(/\s+/g,'-')) así que colisionarían
    // sobre la MISMA ficha financiera, y quitar a cualquiera de las dos
    // (handleRemoveWorker filtra por nombre exacto) las borraría a ambas
    // de golpe.
    if (workersList.some(w => w.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      alert(`Ya hay alguien llamado "${trimmedName}" en el equipo. Si es la misma persona, no hace falta añadirla otra vez; si es alguien distinto, usa un nombre que lo distinga (ej. añadiendo el apellido).`);
      return;
    }

    const newWorker = {
      name: trimmedName,
      role: role.trim(),
      truck: "No Asignado",
      avatar: avatar,
      isPayroll: false,
      rate: 10
    };

    onAddWorker(newWorker);
    setName('');
    setRole('Conductor Extra');
  };

  return (
    <Modal onCerrar={onClose} ancho="md">
      <CabeceraModal icono={Users} degradado="emerald-teal" titulo="Gestionar Equipo" subtitulo="Añade o quita gente del roster de fichaje y asignación." className="mb-6" />

      {workersList.length > 0 && (
        <div className="mb-6 space-y-2">
          <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Equipo Actual ({workersList.length})
          </span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {workersList.map((w) => (
              <div
                key={w.name}
                className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg shrink-0">{w.avatar}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{w.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{w.role}</p>
                  </div>
                </div>

                {confirmRemove === w.name ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { onRemoveWorker(w.name); setConfirmRemove(null); }}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-extrabold"
                    >
                      Sí, quitar
                    </button>
                    <button
                      onClick={() => setConfirmRemove(null)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemove(w.name)}
                    className="shrink-0 p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                    title={`Quitar a ${w.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            Quitar a alguien no borra su ficha en Saldos & Acuerdos ni su historial de fichajes — solo deja de aparecer para fichar o asignarle tareas nuevas.
          </p>
        </div>
      )}

      <div className="border-t border-slate-800 pt-5 mb-1">
        <span className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
          Añadir Trabajador
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo etiqueta="Nombre">
          <Input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Marcos"
            acento="emerald"
          />
        </Campo>

        <Campo etiqueta="Rol">
          <Input
            type="text"
            required
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="Ej: Ayudante Eventos"
            acento="emerald"
          />
        </Campo>

        <Campo etiqueta="Emoji / Icono">
          <Selector value={avatar} onChange={e => setAvatar(e.target.value)} acento="emerald">
            <option value="🚚">🚚 Camión</option>
            <option value="🚛">🚛 Tráiler</option>
            <option value="📦">📦 Almacén / Cajas</option>
            <option value="🧹">🧹 Limpieza</option>
            <option value="👤">👤 Persona Genérica</option>
          </Selector>
        </Campo>

        <button 
          type="submit"
          className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-slate-950 font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          Guardar Trabajador
        </button>
      </form>
    </Modal>
  );
}
