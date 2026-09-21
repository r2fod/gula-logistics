import React, { useState, useEffect } from 'react';
import { ShieldCheck, Check, Trash2, User, Lock } from 'lucide-react';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input, Selector, AreaTexto } from './ui/Campo';

export default function AdminClockEditModal({
  isOpen,
  onClose,
  entry = null, // null if creating a new manual entry
  workersList = [],
  onUpdateEntry,
  onDeleteEntry,
  onClockEntryCreated,
  isAdmin = true,
  pairedEntry = null
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
      id: entry ? entry.id : crypto.randomUUID(),
      workerName,
      role: workerObj.role || 'Operativa',
      isPayroll: workerObj.isPayroll || false,
      rate: Number(rate),
      type,
      timestamp: dateObj.toISOString(),
      // Locale y hour12 fijos: sin esto, el formato (24h o 12h AM/PM)
      // dependía del idioma/región del navegador de quien editaba.
      timeFormatted: dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      dateFormatted: dateObj.toLocaleDateString('es-ES'),
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
    <Modal onCerrar={onClose} ancho="lg" capa={60}>
      <CabeceraModal
        icono={ShieldCheck}
        tono={isAdmin ? 'amber' : 'emerald'}
        titulo={entry ? 'Modificar Fichaje' : 'Nuevo Fichaje Manual'}
        subtitulo={isAdmin
          ? 'Solo Administradores y Socias pueden alterar fichajes registrados.'
          : 'Añade un fichaje que se te olvidó registrar.'}
        insignia={isAdmin && (
          <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-500 text-slate-950 rounded-md">
            ADMIN ONLY
          </span>
        )}
        className="mb-6"
      />

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
        <Campo etiqueta="Trabajador">
          <Selector value={workerName} onChange={handleWorkerChange} className="w-full font-medium">
            {workersList.map((w) => (
              <option key={w.name} value={w.name}>
                {w.avatar} {w.name} — {w.role} ({w.isPayroll ? 'Nómina 14€/h' : 'Extra 10€/h'})
              </option>
            ))}
          </Selector>
        </Campo>

        {/* Type & Rate */}
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Tipo de Registro">
            <Selector value={type} onChange={(e) => setType(e.target.value)} tamano="md" className="w-full font-medium">
              <option value="entrada">🟢 Entrada (Inicio)</option>
              <option value="salida">🔴 Salida (Fin)</option>
            </Selector>
          </Campo>

          <Campo etiqueta="Tarifa Hora (€/h)">
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} tamano="md" texto="ambar" />
          </Campo>
        </div>

        {/* Date & Time Picker */}
        <Campo etiqueta="Fecha y Hora Exacta">
          <Input type="datetime-local" value={dateTimeLocal} onChange={(e) => setDateTimeLocal(e.target.value)} className="w-full font-mono" />
        </Campo>

        {/* Task / Note */}
        <Campo etiqueta="Concepto / Tarea / Nota de Modificación">
          <AreaTexto
            rows="2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Motivo del ajuste o tarea realizada..."
            tamano="md"
            className="w-full resize-none"
          />
        </Campo>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 mt-8">
        {entry ? (
          confirmDelete ? (
            <div className="flex-1 w-full bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl animate-fadeIn">
              <p className="text-xs text-rose-300 font-bold mb-2">¿Seguro que quieres borrar este fichaje?</p>
              {pairedEntry && (
                <p className="text-[10px] text-rose-400 mb-3 bg-rose-500/20 p-2 rounded">
                  ⚠️ <b>¡Ojo!</b> Este fichaje está emparejado con una <b>{pairedEntry.type.toUpperCase()}</b> a las <b>{pairedEntry.timeFormatted}</b>. 
                  Si borras esto, el turno quedará descuadrado. Deberías borrar también su pareja.
                </p>
              )}
              <div className="flex space-x-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md shadow-rose-600/20"
                >
                  Sí, Eliminar
                </button>
              </div>
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
    </Modal>
  );
}
