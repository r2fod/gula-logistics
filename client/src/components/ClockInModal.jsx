import React, { useState, useEffect } from 'react';
import { Clock, Play, Square, X, CheckCircle2, User, DollarSign, ShieldCheck, Lock } from 'lucide-react';
import { getActiveShiftForWorker } from '../data/shiftCalculations';

export default function ClockInModal({
  isOpen,
  onClose,
  workersList,
  initialWorkerName,
  initialTaskName,
  clockEntries = [],
  onClockEntryCreated
}) {
  const [selectedWorker, setSelectedWorker] = useState(initialWorkerName || workersList[0]?.name || 'Gonzalo');
  const [note, setNote] = useState(initialTaskName || '');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync note when initialTaskName changes (task-level clock-in)
  useEffect(() => {
    if (isOpen && initialTaskName) {
      setNote(initialTaskName);
    } else if (isOpen && !initialTaskName) {
      setNote('');
    }
  }, [isOpen, initialTaskName]);

  // Si el trabajador está actualmente en turno, igual que en WorkerView —
  // se calcula de los fichajes reales (API/Mongo) en orden cronológico, no
  // de una copia propia en localStorage (podía quedar desincronizada si el
  // fichaje de entrada se hizo desde otro dispositivo, ej. un móvil
  // compartido en el evento) ni del orden del array tal cual (el servidor
  // devuelve los más recientes primero, así que "el último del array" no
  // es "el más reciente" — ver getActiveShiftForWorker).
  const activeShift = getActiveShiftForWorker(clockEntries, selectedWorker);

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
      taskName: note.trim() || 'Inicio de Jornada Operativa',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
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
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>En Turno & Tarea Activa</span>
                </span>
                <span className="text-emerald-400 font-mono">{activeShift.timeFormatted}</span>
              </div>
              {activeShift.taskName && (
                <p className="text-[11px] text-slate-300 font-medium pt-1 border-t border-emerald-500/20">
                  📌 <b>Tarea:</b> {activeShift.taskName}
                </p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs text-center font-medium">
              ⚪ Actualmente fuera de turno
            </div>
          )}

          {/* Task Presets & Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Tarea / Operativa a Realizar
            </label>
            <select
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white font-medium focus:outline-none focus:border-emerald-500 mb-2"
            >
              <option value="">Selecciona o escribe una tarea...</option>
              <option value="🚚 Ruta Albacar — Recogida Camión (Gonzalo y Ricardo)">🚚 Ruta Albacar — Recogida Camión</option>
              <option value="📦 Pre-carga en Almacén Base (Johan y Jeferson)">📦 Pre-carga en Almacén Base</option>
              <option value="🚚 Descarga Fincas — Mas dels Refranys y Villajoyosa">🚚 Descarga Fincas (Mas dels Refranys)</option>
              <option value="🚚 Ruta Carvillo — Recogida 90 Sillas Extra">🚚 Ruta Carvillo — 90 Sillas Extra</option>
              <option value="🧹 Higienización & Limpieza Vajilla Eventos (Kerly y Jose)">🧹 Higienización & Limpieza Vajilla</option>
              <option value="📋 Supervisión Flota & Validación Albaranes (Raúl e Irene)">📋 Supervisión Flota & Albaranes</option>
              <option value="🏔️ Evento Boda Sot de Chera (250 pax)">🏔️ Evento Boda Sot de Chera</option>
              <option value="🔄 Logística Inversa & Estiba Camiones">🔄 Logística Inversa & Estiba</option>
            </select>

            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="O escribe una tarea personalizada..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Lock Security Notice */}
        <div className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start space-x-2">
          <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            <b>Aviso de Seguridad:</b> Una vez enviado el fichaje, queda registrado y <b>bloqueado</b>. Solo la Administración / Socias puede modificarlo.
          </span>
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
