import React, { useState } from 'react';
import { Users, Save, UserPlus, Info } from 'lucide-react';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import BotonCerrar from './ui/BotonCerrar';
import { Campo, Input } from './ui/Campo';
import FichaTrabajador from './equipo/FichaTrabajador';
import FilaTrabajador from './equipo/FilaTrabajador';
import { gruposDeEquipo } from '../data/equipoRoles';
import { useDialog } from '../contexts/DialogContext';

// Iconos que se pueden elegir para alguien nuevo.
const ICONOS = [
  ['🚚', 'Camión'],
  ['🚛', 'Tráiler'],
  ['📦', 'Almacén'],
  ['🧹', 'Limpieza'],
  ['👤', 'Persona'],
];
const ROL_INICIAL = 'Conductor Extra';

// «Gestionar equipo»: la gente agrupada por perfil (conductores, apoyo, preparación,
// limpieza…), con su ficha editable (rol, "solo si hace falta", nota, disponibilidad
// fija) y para añadir o quitar. Cabecera fija y un solo scroll.
//
// `onUpdateWorker(nombre, cambios)` → true si se guardó (ver FichaTrabajador).
export default function AdminWorkerEditorModal({ isOpen, onClose, workersList = [], onAddWorker, onRemoveWorker, onUpdateWorker = null }) {
  const { alert } = useDialog();
  const [editando, setEditando] = useState(null); // nombre con la ficha abierta
  const [confirmRemove, setConfirmRemove] = useState(null); // nombre pendiente de confirmar
  const [anadiendo, setAnadiendo] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROL_INICIAL);
  const [avatar, setAvatar] = useState('🚚');

  if (!isOpen) return null;

  const cerrarFormulario = () => {
    setAnadiendo(false);
    setName('');
    setRole(ROL_INICIAL);
    setAvatar('🚚');
  };

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

    onAddWorker({ name: trimmedName, role: role.trim(), truck: 'No Asignado', avatar, isPayroll: false, rate: 10 });
    cerrarFormulario();
  };

  const grupos = gruposDeEquipo(workersList);

  return (
    <Modal onCerrar={onClose} ancho="lg" disposicion="columna" botonCerrar={false} etiqueta="Gestionar equipo">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 p-4 sm:p-5">
        <CabeceraModal
          icono={Users}
          degradado="emerald-teal"
          compacta
          titulo="Gestionar equipo"
          subtitulo={`${workersList.length} ${workersList.length === 1 ? 'persona' : 'personas'} · el lápiz abre su ficha`}
        />
        <BotonCerrar onClick={onClose} />
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {anadiendo ? (
          <form onSubmit={handleSubmit} aria-label="Añadir persona" className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 sm:p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Añadir persona
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre">
                <Input type="text" required autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Marcos" acento="emerald" />
              </Campo>
              <Campo etiqueta="Rol">
                <Input type="text" required value={role} onChange={e => setRole(e.target.value)} placeholder="Ej: Ayudante Eventos" acento="emerald" />
              </Campo>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Icono</legend>
              <div className="flex flex-wrap gap-2">
                {ICONOS.map(([emoji, texto]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatar(emoji)}
                    aria-pressed={avatar === emoji}
                    className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${avatar === emoji ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
                  >
                    <span aria-hidden="true" className="text-base">{emoji}</span>{texto}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={cerrarFormulario} className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700">
                Cancelar
              </button>
              <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:opacity-95">
                <Save className="h-4 w-4" aria-hidden="true" /> Guardar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAnadiendo(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-900/70 px-4 py-3 text-sm font-semibold text-slate-400 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:text-emerald-300"
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Añadir persona al equipo
          </button>
        )}

        {grupos.map(grupo => (
          <section key={grupo.titulo} aria-label={grupo.titulo}>
            <h3 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {grupo.titulo}
              <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">{grupo.personas.length}</span>
            </h3>
            <ul className="space-y-2">
              {grupo.personas.map(w => (
                <FilaTrabajador
                  key={w.name}
                  trabajador={w}
                  editando={editando === w.name}
                  confirmando={confirmRemove === w.name}
                  onEditar={onUpdateWorker ? () => setEditando(editando === w.name ? null : w.name) : null}
                  onQuitar={() => setConfirmRemove(w.name)}
                  onConfirmarQuitar={() => { onRemoveWorker(w.name); setConfirmRemove(null); }}
                  onCancelarQuitar={() => setConfirmRemove(null)}
                >
                  {editando === w.name && onUpdateWorker && (
                    <FichaTrabajador trabajador={w} onGuardar={(cambios) => onUpdateWorker(w.name, cambios)} onCerrar={() => setEditando(null)} />
                  )}
                </FilaTrabajador>
              ))}
            </ul>
          </section>
        ))}

        {workersList.length > 0 && (
          <p className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-[11px] leading-snug text-slate-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            Quitar a alguien no borra su ficha en Saldos & Acuerdos ni sus fichajes: solo deja de aparecer para fichar o para asignarle tareas nuevas.
          </p>
        )}
      </div>
    </Modal>
  );
}
