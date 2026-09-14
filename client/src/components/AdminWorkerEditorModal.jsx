import React, { useState } from 'react';
import { X, Users, Save, CheckCircle2 } from 'lucide-react';

export default function AdminWorkerEditorModal({ isOpen, onClose, onAddWorker }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('Conductor Extra');
  const [avatar, setAvatar] = useState('🚚');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newWorker = {
      name: name.trim(),
      role: role.trim(),
      truck: "No Asignado",
      avatar: avatar,
      isPayroll: false,
      rate: 10
    };

    onAddWorker(newWorker);
    setName('');
    setRole('Conductor Extra');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 p-0.5 shadow-lg">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold font-['Outfit']">Añadir Trabajador</h3>
            <p className="text-xs text-slate-400">Se añadirá al control de saldos automáticamente.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nombre</label>
            <input 
              type="text" 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Marcos"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Rol</label>
            <input 
              type="text" 
              required
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Ej: Ayudante Eventos"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Emoji / Icono</label>
            <select 
              value={avatar}
              onChange={e => setAvatar(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm focus:outline-none focus:border-emerald-500"
            >
              <option value="🚚">🚚 Camión</option>
              <option value="🚛">🚛 Tráiler</option>
              <option value="📦">📦 Almacén / Cajas</option>
              <option value="🧹">🧹 Limpieza</option>
              <option value="👤">👤 Persona Genérica</option>
            </select>
          </div>

          <button 
            type="submit"
            className="w-full py-3 mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-slate-950 font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Trabajador
          </button>
        </form>
      </div>
    </div>
  );
}
