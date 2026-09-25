import React, { useState, useEffect } from 'react';
import { BrainCircuit, Trash2, Plus, RefreshCw } from 'lucide-react';
import { getAiMemories, addAiMemory, deleteAiMemory } from '../data/apiService';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';

export default function AdminAiMemoryModal({ isOpen, onClose }) {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMemory, setNewMemory] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const data = await getAiMemories();
      setMemories(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
    }
  }, [isOpen]);

  const handleDelete = async (id) => {
    await deleteAiMemory(id);
    setMemories(prev => prev.filter(m => m._id !== id));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newMemory.trim()) return;
    setIsAdding(true);
    const added = await addAiMemory(newMemory.trim());
    if (added) {
      setMemories([added, ...memories]);
      setNewMemory('');
    }
    setIsAdding(false);
  };

  if (!isOpen) return null;

  return (
    <Modal onCerrar={onClose} ancho="2xl">
      <CabeceraModal
        icono={BrainCircuit}
        degradado="amber-indigo"
        titulo="Grafo de Conocimiento IA"
        subtitulo="Gestiona la memoria a largo plazo (Graphify) de Gemini"
      />

      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4 mb-4">
        <h3 className="text-sm font-semibold text-white">Añadir Nueva Regla</h3>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl bg-slate-950 border border-slate-800 p-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            placeholder="Ej: A Gonzalo no le gusta trabajar en fin de semana..."
            value={newMemory}
            onChange={(e) => setNewMemory(e.target.value)}
          />
          <button
            type="submit"
            disabled={isAdding || !newMemory.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold flex flex-col justify-center disabled:opacity-50 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-slate-500 flex flex-col items-center">
            <RefreshCw className="w-6 h-6 animate-spin mb-2 opacity-50" />
            <p>Cargando nodos del grafo...</p>
          </div>
        ) : memories.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
            No hay preferencias guardadas. La IA irá aprendiendo a medida que le des instrucciones desde el Asistente.
          </div>
        ) : (
          memories.map(mem => (
            <div key={mem._id} className="flex justify-between items-center gap-4 bg-slate-900/80 p-3 rounded-xl border border-slate-800 group">
              <span className="text-sm text-slate-300 flex-1">{mem.content}</span>
              <button 
                onClick={() => handleDelete(mem._id)} 
                className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors opacity-50 group-hover:opacity-100" 
                title="Borrar nodo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
