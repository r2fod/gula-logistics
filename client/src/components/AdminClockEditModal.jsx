import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock, X, Check, Trash2, Calendar, User, DollarSign, Edit3, Plus, Lock } from 'lucide-react';

export default function AdminClockEditModal({
  isOpen,
  onClose,
  entry = null, // null if creating a new manual entry
  workersList = [],
  onUpdateEntry,
  onDeleteEntry,
  onClockEntryCreated,
  isAdmin = true
}) {
  const [workerName, setWorkerName] = useState('');
  const [type, setType] = useState('entrada');
  const [dateTimeLocal, setDateTimeLocal] = useState('');
  const [rate, setRate] = useState(10);
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (entry) {
      setWorkerName(entry.workerName || workersList[0]?.name || '');
      setType(entry.type || 'entrada');
      setNote(entry.note || entry.taskName || '');
      setRate(entry.rate || 10);
      setConfirmDelete(false);

      if (entry.timestamp) {
        const d = new Date(entry.timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDateTimeLocal(formatted);
      } else {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        setDateTimeLocal(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
      }
    } else {
      setWorkerName(workersList[0]?.name || 'Gonzalo');
      setType('entrada');
      setNote('');
      setRate(10);
      setConfirmDelete(false);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      setDateTimeLocal(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`);
    }
  }, [entry, isOpen, workersList]);

  if (!isOpen) return null;

  const handleWorkerChange = (e) => {
    const selectedName = e.target.value;
    setWorkerName(selectedName);
    const workerObj = workersList.find(w => w.name === selectedName);
    if (workerObj) {
      setRate(workerObj.rate || (workerObj.isPayroll ? 14 : 10));
    }
  };

  const handleSave = () => {
    if (!workerName || !dateTimeLocal) return;

    const dateObj = new Date(dateTimeLocal);
    const workerObj = workersList.find(w => w.name === workerName) || { role: 'Operativa', isPayroll: false };

    const entryData = {
      id: entry ? entry.id : Date.now().toString(),
      workerName,
      role: workerObj.role || 'Operativa',
      isPayroll: workerObj.isPayroll || false,
      rate: Number(rate),
      type,
      timestamp: dateObj.toISOString(),
      // Locale y hour12 fijos: sin esto, el formato (24h o 12h AM/PM)
      // dependía del idioma/región del navegador de quien editaba.
      timeFormatted: dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      dateFormatted: dateObj.toLocaleDateString(),
      taskName: note.trim() || (type === 'entrada' ? 'Inicio de Jornada Operativa' : 'Cierre de Jornada'),
      note: note.trim(),
      editedByAdmin: isAdmin,
      editedAt: new Date().toISOString()
    };

    if (entry) {
      if (onUpdateEntry) onUpdateEntry(entryData);
    } else {
      if (onClockEntryCreated) onClockEntryCreated(entryData);
    }

    onClose();
  };

  const handleDelete = () => {
    if (entry && onDeleteEntry) {
      onDeleteEntry(entry.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center space-x-3 mb-6">
          <div className={`w-12 h-12 rounded-2xl ${isAdmin ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'} flex items-center justify-center border`}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-xl font-bold font-['Outfit']">
                {entry ? 'Modificar Fichaje' : 'Nuevo Fichaje Manual'}
              </h3>
              {isAdmin && (
                <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500 text-slate-950 rounded-md">
                  ADMIN ONLY
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isAdmin
                ? 'Solo Administradores y Socias pueden alterar fichajes registrados.'
                : 'Añade un fichaje que se te olvidó registrar.'}
            </p>
          </div>
        </div>

        {/* Notice */}
        {isAdmin ? (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl mb-5 flex items-center space-x-2.5 text-xs text-amber-300">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <b>Control de Integridad:</b> Este registro fue bloqueado al crearse por el trabajador. Solo la dirección puede modificar horas o importes.
            </span>
          </div>
        ) : (
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl mb-5 flex items-center space-x-2.5 text-xs text-emerald-300">
            <User className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              <b>Aviso:</b> Esto crea un fichaje nuevo. Para corregir uno que ya enviaste, pide a Administración/Socias.
            </span>
          </div>
        )}

        <div className="space-y-4 mb-6">
          {/* Worker Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Trabajador
            </label>
            <select
              value={workerName}
              onChange={handleWorkerChange}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-amber-500"
            >
              {workersList.map((w) => (
                <option key={w.name} value={w.name}>
                  {w.avatar} {w.name} — {w.role} ({w.isPayroll ? 'Nómina 14€/h' : 'Extra 10€/h'})
                </option>
              ))}
            </select>
          </div>

          {/* Type & Rate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Tipo de Registro
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500"
              >
                <option value="entrada">🟢 Entrada (Inicio)</option>
                <option value="salida">🔴 Salida (Fin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Tarifa Hora (€/h)
              </label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Fecha y Hora Exacta
            </label>
            <input
              type="datetime-local"
              value={dateTimeLocal}
              onChange={(e) => setDateTimeLocal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Task / Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Concepto / Tarea / Nota de Modificación
            </label>
            <textarea
              rows="2"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo del ajuste o tarea realizada..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          {entry ? (
            confirmDelete ? (
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  onClick={handleDelete}
                  className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-extrabold flex items-center space-x-1 shadow-md shadow-rose-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Sí, Eliminar</span>
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar Fichaje</span>
              </button>
            )
          ) : (
            <div></div>
          )}

          {!confirmDelete && (
            <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-slate-950 text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-lg transition-all ${
                  isAdmin ? 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>{entry ? 'Guardar Cambios' : 'Crear Fichaje'}</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
