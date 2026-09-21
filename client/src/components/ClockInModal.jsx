import React, { useState, useEffect } from 'react';
import { Briefcase, Clock, Euro, Lock, Pin, Play, Square } from 'lucide-react';
import { getActiveShiftForWorker } from '../data/shiftCalculations';
import { crearFichaje } from '../data/fichajes';
import { formatTime, formatDateLong } from '../utils/dateUtils';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input, Selector } from './ui/Campo';

export default function ClockInModal({
  isOpen,
  onClose,
  workersList,
  initialWorkerName,
  initialTaskName,
  taskRef,
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

  // Quien ficha: el elegido en el selector (con el rol y la tarifa de su ficha).
  const trabajadorElegido = { ...currentWorkerObj, name: selectedWorker };

  const handleClockIn = () => {
    onClockEntryCreated(crearFichaje({
      trabajador: trabajadorElegido,
      tipo: 'entrada',
      taskName: note.trim() || 'Inicio de Jornada Operativa',
      note: note.trim(),
      // Referencia a la tarea real del planning (día + índice) para poder
      // marcarla como hecha sola cuando se fiche la salida de este turno.
      taskRef: taskRef || null
    }));
    setNote('');
    onClose();
  };

  const handleClockOut = () => {
    onClockEntryCreated(crearFichaje({ trabajador: trabajadorElegido, tipo: 'salida', note: note.trim() }));
    setNote('');
    onClose();
  };

  return (
    <Modal onCerrar={onClose} ancho="md">
      <CabeceraModal icono={Clock} tono="emerald" titulo="Fichar Jornada Operativa" subtitulo="Registro de hora exacta de entrada y salida" className="mb-6" />

      {/* Live Clock Display */}
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-center mb-5">
        <span className="text-3xl font-extrabold font-mono text-emerald-400 tracking-wider">
          {formatTime(currentTime)}
        </span>
        <p className="text-xs text-slate-400 mt-1 capitalize">
          {formatDateLong(currentTime)}
        </p>
      </div>

      {/* Worker Selector */}
      <div className="space-y-4 mb-6">
        <Campo etiqueta="Seleccionar Trabajador">
          <Selector
            value={selectedWorker}
            onChange={(e) => setSelectedWorker(e.target.value)}
            acento="emerald"
            className="w-full font-medium"
          >
            {workersList.map((w) => (
              <option key={w.name} value={w.name}>
                {w.avatar} {w.name} — {w.isPayroll ? "Nómina Fija" : "Extra 10€/h"}
              </option>
            ))}
          </Selector>
        </Campo>

        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Tipo de Contrato:</span>
          {currentWorkerObj.isPayroll ? (
            <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              <Briefcase className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Nómina Fija (Irene / Raúl)
            </span>
          ) : (
            <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              <Euro className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Extra 10,00 € / hora
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
                <Pin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" /><b>Tarea:</b> {activeShift.taskName}
              </p>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs text-center font-medium">
            ⚪ Actualmente fuera de turno
          </div>
        )}

        {/* Task Presets & Selection */}
        <Campo etiqueta="Tarea / Operativa a Realizar">
          <Selector
            value={note}
            onChange={(e) => setNote(e.target.value)}
            tamano="md"
            acento="emerald"
            className="w-full font-medium mb-2"
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
          </Selector>

          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O escribe una tarea personalizada..."
            tamano="md"
            acento="emerald"
          />
        </Campo>
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
          <span>Fichar Entrada</span>
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
          <span>Fichar Salida</span>
        </button>
      </div>
    </Modal>
  );
}
