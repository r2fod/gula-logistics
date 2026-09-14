import React, { useState } from 'react';
import { DollarSign, Clock, Users, X, Copy, Check, Trash2, Calendar, FileText, Lock, Edit3, Plus, ShieldCheck } from 'lucide-react';
import AdminClockEditModal from './AdminClockEditModal';

export default function PayrollReportModal({ 
  isOpen, 
  onClose, 
  entries = [], 
  workersList = [], 
  onClearEntries,
  isAdmin = true,
  onUpdateEntry,
  onDeleteEntry,
  onClockEntryCreated
}) {
  const [copied, setCopied] = useState(false);
  const [filterWorker, setFilterWorker] = useState('all');
  const [viewTab, setViewTab] = useState('shifts'); // 'shifts' | 'raw_entries'
  const [editingEntry, setEditingEntry] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  if (!isOpen) return null;

  // Process shift pairs (Entrada -> Salida)
  const shifts = [];
  const activeWorkerShifts = {};

  entries.forEach(entry => {
    const { workerName, type, timestamp, timeFormatted, dateFormatted, isPayroll, rate } = entry;

    if (type === 'entrada') {
      activeWorkerShifts[workerName] = entry;
    } else if (type === 'salida' && activeWorkerShifts[workerName]) {
      const startEntry = activeWorkerShifts[workerName];
      delete activeWorkerShifts[workerName];

      const startDate = new Date(startEntry.timestamp);
      const endDate = new Date(timestamp);
      const diffMs = endDate - startDate;
      const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));

      const hours = Math.floor(diffHours);
      const minutes = Math.floor((diffHours - hours) * 60);

      const isSalaried = isPayroll || workerName === 'Irene' || workerName === 'Raúl';
      const hourlyRate = rate || (isSalaried ? 14 : 10);
      const totalCost = diffHours * hourlyRate;

      shifts.push({
        id: `${startEntry.id}-${entry.id}`,
        startEntry,
        endEntry: entry,
        workerName,
        isSalaried,
        rate: hourlyRate,
        startDate: startEntry.dateFormatted,
        startTime: startEntry.timeFormatted,
        endDate: dateFormatted,
        endTime: timeFormatted,
        durationFormatted: `${hours}h ${minutes}m`,
        durationHours: diffHours,
        cost: totalCost,
        note: startEntry.note || entry.note
      });
    }
  });

  // Filtered shifts
  const filteredShifts = filterWorker === 'all' 
    ? shifts 
    : shifts.filter(s => s.workerName === filterWorker);

  // Filtered raw entries
  const filteredRawEntries = filterWorker === 'all'
    ? entries
    : entries.filter(e => e.workerName === filterWorker);

  // Summary Metrics
  const totalExtraCost = shifts.reduce((acc, curr) => acc + (curr.isSalaried ? 0 : curr.cost), 0);
  const totalPayrollValuation = shifts.reduce((acc, curr) => acc + (curr.isSalaried ? curr.cost : 0), 0);
  const totalExtraHours = shifts.reduce((acc, curr) => acc + (curr.isSalaried ? 0 : curr.durationHours), 0);
  const activeClockedInCount = Object.keys(activeWorkerShifts).length;

  const handleCopySummary = () => {
    let summaryText = `📋 *INFORME DE CONTROL HORARIO Y COSTES - GULA LOGÍSTICA*\n\n`;
    summaryText += `💶 *Gasto Total Extras (10€/h):* ${totalExtraCost.toFixed(2)} €\n`;
    summaryText += `⭐ *Valoración Interna Nóminas (14€/h):* ${totalPayrollValuation.toFixed(2)} €\n`;
    summaryText += `⏱️ *Total Horas Trabajadas:* ${totalExtraHours.toFixed(1)} h\n`;
    summaryText += `----------------------------------------\n\n`;

    shifts.forEach(s => {
      summaryText += `👤 *${s.workerName}* (${s.isSalaried ? 'Nómina (Control 14€/h)' : '10€/h'})\n`;
      summaryText += `  • Horario: ${s.startTime} ➔ ${s.endTime} (${s.startDate})\n`;
      summaryText += `  • Duración: ${s.durationFormatted}\n`;
      summaryText += `  • Coste: ${s.isSalaried ? `${s.cost.toFixed(2)} € (Control Interno)` : `${s.cost.toFixed(2)} €`}\n\n`;
    });

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleOpenEdit = (entryObj) => {
    setEditingEntry(entryObj);
    setIsAdminModalOpen(true);
  };

  const handleOpenCreateNew = () => {
    setEditingEntry(null);
    setIsAdminModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold font-['Outfit']">Informe de Fichajes, Horas & Nóminas</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Fichajes Bloqueados</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Control de horas trabajadas y tarificación. Modificación restringida a Administración.</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {isAdmin && (
              <button
                onClick={handleOpenCreateNew}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold flex items-center space-x-1.5 transition-all"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>+ Fichaje Admin</span>
              </button>
            )}

            <button
              onClick={handleCopySummary}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>¡Resumen Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Lock Info Banner */}
        <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl mb-5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <b>Regla de Seguridad:</b> Una vez enviado un fichaje, queda bloqueado para los trabajadores. Solo el <b>Admin / Socias</b> puede modificar horarios o importes.
            </span>
          </div>
          {isAdmin ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-1 rounded-md font-bold shrink-0">
              👑 Modo Admin Activo
            </span>
          ) : (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-md font-bold shrink-0">
              🔒 Vista Trabajador
            </span>
          )}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Gasto Total Extras</p>
            <p className="text-2xl font-bold text-amber-400 mt-1 font-['Outfit']">
              {totalExtraCost.toFixed(2)} €
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Calculado a 10,00 €/h</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Horas Extras Totales</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-['Outfit']">
              {totalExtraHours.toFixed(1)} h
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{shifts.length} jornadas completadas</p>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">Trabajadores en Turno</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1 font-['Outfit']">
              {activeClockedInCount} activos
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Fichaje de entrada abierto</p>
          </div>
        </div>

        {/* View Tabs & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          {/* Sub-tabs */}
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewTab('shifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'shifts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Jornadas Completadas ({shifts.length})
            </button>
            <button
              onClick={() => setViewTab('raw_entries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewTab === 'raw_entries' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚙️ Fichajes Individuales ({entries.length})
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">Trabajador:</span>
            <select
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Todos ({workersList.length})</option>
              {workersList.map(w => (
                <option key={w.name} value={w.name}>{w.name}</option>
              ))}
            </select>

            {isAdmin && entries.length > 0 && (
              <button
                onClick={onClearEntries}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1 ml-2"
                title="Resetear todos los fichajes (Solo Admin)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Admin</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Shift Pairs (Jornadas Completadas) */}
        {viewTab === 'shifts' && (
          filteredShifts.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800">
              <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No hay registros de jornadas completadas para mostrar.</p>
              <p className="text-[11px] text-slate-500 mt-1">Los fichajes se calculan cuando un trabajador ficha su entrada y salida.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Trabajador</th>
                    <th className="py-3 px-3">Tipo / Tarifa</th>
                    <th className="py-3 px-3">Entrada</th>
                    <th className="py-3 px-3">Salida</th>
                    <th className="py-3 px-3">Horas</th>
                    <th className="py-3 px-3 text-right">Coste (€)</th>
                    <th className="py-3 px-3 text-center">Estado / Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredShifts.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-white">
                        {s.workerName}
                      </td>
                      <td className="py-3 px-3">
                        {s.isSalaried ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                            Nómina Fija
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Extra (10,00 €/h)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        <div>{s.startTime}</div>
                        <div className="text-[10px] text-slate-500">{s.startDate}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        <div>{s.endTime}</div>
                        <div className="text-[10px] text-slate-500">{s.endDate}</div>
                      </td>
                      <td className="py-3 px-3 font-semibold text-emerald-400">
                        {s.durationFormatted}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-amber-400 font-mono text-sm">
                        {s.isSalaried ? '0,00 €' : `${s.cost.toFixed(2)} €`}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isAdmin ? (
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={() => handleOpenEdit(s.startEntry)}
                              className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                              title="Editar Fichaje Entrada (Admin)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(s.endEntry)}
                              className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 transition-colors"
                              title="Editar Fichaje Salida (Admin)"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center justify-center space-x-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Bloqueado</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Tab 2: Raw Individual Entries (Listado Completo & Edición Admin) */}
        {viewTab === 'raw_entries' && (
          filteredRawEntries.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800">
              <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No hay fichajes individuales registrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Fecha & Hora</th>
                    <th className="py-3 px-3">Trabajador</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3">Tarea / Nota</th>
                    <th className="py-3 px-3">Tarifa (€/h)</th>
                    <th className="py-3 px-3 text-center">Edición Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredRawEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3 px-3 text-slate-200 font-mono">
                        <div>{entry.timeFormatted}</div>
                        <div className="text-[10px] text-slate-500">{entry.dateFormatted}</div>
                      </td>
                      <td className="py-3 px-3 font-bold text-white">
                        {entry.workerName}
                      </td>
                      <td className="py-3 px-3">
                        {entry.type === 'entrada' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                            🟢 ENTRADA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
                            🔴 SALIDA
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {entry.taskName || entry.note || '—'}
                      </td>
                      <td className="py-3 px-3 font-bold text-amber-400">
                        {entry.rate || 10} €/h
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isAdmin ? (
                          <button
                            onClick={() => handleOpenEdit(entry)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center space-x-1 mx-auto"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center justify-center space-x-1">
                            <Lock className="w-3 h-3 text-slate-400" />
                            <span>Bloqueado</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Admin Clock Edit Modal */}
      <AdminClockEditModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        entry={editingEntry}
        workersList={workersList}
        onUpdateEntry={onUpdateEntry}
        onDeleteEntry={onDeleteEntry}
        onClockEntryCreated={onClockEntryCreated}
      />
    </div>
  );
}
