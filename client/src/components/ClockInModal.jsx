import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, X, CheckCircle2, User, DollarSign, ShieldCheck } from 'lucide-react';

export default function ClockInModal({ 
  isOpen, 
  onClose, 
  workersList, 
  initialWorkerName, 
  onClockEntryCreated 
}) {
  const [selectedWorker, setSelectedWorker] = useState(initialWorkerName || workersList[0]?.name || 'Gonzalo');
  const [note, setNote] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeShift, setActiveShift] = useState(null);

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if selected worker is currently clocked in
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gula_clock_entries_v1');
      if (saved) {
        const entries = JSON.parse(saved);
        const workerEntries = entries.filter(e => e.workerName === selectedWorker);
        const lastEntry = workerEntries[workerEntries.length - 1];
        if (lastEntry && lastEntry.type === 'entrada') {
          setActiveShift(lastEntry);
        } else {
          setActiveShift(null);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedWorker, isOpen]);

  if (!isOpen) return null;

  const currentWorkerObj = workersList.find(w => w.name === selectedWorker) || workersList[0];

  const handleClockIn = () => {
    const now = new Date();
    const entry = {
      id: Date.now().toString(),
      workerName: selectedWorker,
      role: currentWorkerObj.role,
      isPayroll: currentWorkerObj.isPayroll,
      rate: currentWorkerObj.rate || 10,
      type: 'entrada',
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateFormatted: now.toLocaleDateString(),
      note: note.trim()
    };
    onClockEntryCreated(entry);
    setNote('');
    onClose();
  };

  const handleClockOut = () => {
    const now = new Date();
    const entry = {
      id: Date.now().toString(),
      workerName: selectedWorker,
      role: currentWorkerObj.role,
      isPayroll: currentWorkerObj.isPayroll,
      rate: currentWorkerObj.rate || 10,
      type: 'salida',
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      dateFormatted: now.toLocaleDateString(),
      note: note.trim()
    };
    onClockEntryCreated(entry);
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-['Outfit']">Fichar Jornada Operativa</h3>
            <p className="text-xs text-slate-400">Registro de hora exacta de entrada y salida</p>
          </div>
        </div>

        {/* Live Clock Display */}
        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center mb-5">
          <span className="text-3xl font-extrabold font-mono text-emerald-400 tracking-wider">
            {currentTime.toLocaleTimeString()}
          </span>
          <p className="text-xs text-slate-400 mt-1 capitalize">
            {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Worker Selector */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Seleccionar Trabajador
            </label>
            <select
              value={selectedWorker}
              onChange={(e) => setSelectedWorker(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              {workersList.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.avatar} {w.name} — {w.isPayroll ? "Nómina Fija" : "Extra 10€/h"}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-400">Tipo de Contrato:</span>
            {currentWorkerObj.isPayroll ? (
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                💼 Nómina Fija (Irene / Raúl)
              </span>
            ) : (
              <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                💶 Extra 10,00 € / hora
              </span>
            )}
          </div>

          {/* Active Shift Status */}
          {activeShift ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>En Turno desde las <strong>{activeShift.timeFormatted}</strong></span>
              </span>
              <span className="text-[10px] text-slate-400">{activeShift.dateFormatted}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs text-center">
              Actualmente fuera de turno
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Observaciones / Tarea (Opcional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ej. Recogida Camión Albacar / Carga evento"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleClockIn}
            disabled={!!activeShift}
            className={`py-3.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
              activeShift 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>🟢 Fichar Entrada</span>
          </button>

          <button
            onClick={handleClockOut}
            disabled={!activeShift}
            className={`py-3.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center space-x-2 transition-all ${
              !activeShift 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white shadow-lg shadow-rose-500/20'
            }`}
          >
            <Square className="w-4 h-4 fill-current" />
            <span>🔴 Fichar Salida</span>
          </button>
        </div>
      </div>
    </div>
  );
}
