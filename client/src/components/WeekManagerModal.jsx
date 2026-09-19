import React, { useState } from 'react';
import { Calendar, Plus, X, Copy, Sparkles } from 'lucide-react';

export default function WeekManagerModal({ isOpen, onClose, onCreateWeek, currentWeekName }) {
  const [weekName, setWeekName] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [cloneCurrent, setCloneCurrent] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!weekName.trim() || !dateRange.trim()) return;

    onCreateWeek({
      name: weekName.trim(),
      dateRange: dateRange.trim(),
      cloneCurrent
    });

    setWeekName('');
    setDateRange('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl text-white max-h-[96vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-['Outfit']">Crear Nueva Semana</h3>
            <p className="text-xs text-slate-400">Añade una nueva semana de planificación a la app</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Nombre de la Semana
            </label>
            <input
              type="text"
              required
              value={weekName}
              onChange={(e) => setWeekName(e.target.value)}
              placeholder="ej. Semana 4"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Rango de Fechas
            </label>
            <input
              type="text"
              required
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              placeholder="ej. Del 22 al 27 de Septiembre de 2026"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="cloneCurrent"
              checked={cloneCurrent}
              onChange={(e) => setCloneCurrent(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="cloneCurrent" className="text-xs text-slate-300 flex items-center space-x-1 cursor-pointer">
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Clonar equipo y camiones de la semana actual ({currentWeekName})</span>
            </label>
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Crear Semana</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
