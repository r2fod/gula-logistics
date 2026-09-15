import React, { useState } from 'react';
import { DollarSign, Clock, Users, X, Copy, Check, Trash2, Calendar, FileText, Lock, Edit3, Plus, ShieldCheck } from 'lucide-react';
import AdminClockEditModal from './AdminClockEditModal';
import { pairShiftsFromEntries } from '../data/shiftCalculations';

export default function PayrollReportModal({
  isOpen,
  onClose,
  entries = [],
  workersList = [],
  onClearEntries,
  isAdmin = true,
  onUpdateEntry,
  onDeleteEntry,
  onClockEntryCreated,
  activeWeekData = null
}) {
  const [copied, setCopied] = useState(false);
  const [filterWorker, setFilterWorker] = useState('all');
  const [viewTab, setViewTab] = useState('shifts'); // 'shifts' | 'raw_entries' | 'estimated'
  const [editingEntry, setEditingEntry] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  if (!isOpen) return null;

  // Process shift pairs (Entrada -> Salida)
  const { shifts, activeShifts: activeWorkerShifts } = pairShiftsFromEntries(entries);

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

  // Estimación a partir del planning (horario de las tareas), NO de fichajes
  // reales — solo de referencia, nunca entra en las cifras de arriba.
  const parseTimeFrame = (timeFrame) => {
    const match = (timeFrame || '').match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [, h1, m1, h2, m2] = match;
    const start = Number(h1) * 60 + Number(m1);
    let end = Number(h2) * 60 + Number(m2);
    if (end <= start) end += 24 * 60; // cruza medianoche (p.ej. bodas 09:00 - 02:00)
    return { start, end };
  };

  const estimationIntervals = []; // { workerName, dayKey, start, end }
  const unestimableTasks = []; // tareas con gente asignada pero sin horario completo

  const registerTaskEstimate = (dayKey, dayLabel, taskLabel, timeFrame, assigned) => {
    if (!assigned || assigned.length === 0) return;
    const range = parseTimeFrame(timeFrame);
    if (!range) {
      unestimableTasks.push({ dayLabel, label: taskLabel || '(sin descripción)', assigned });
      return;
    }
    assigned.forEach(workerName => {
      estimationIntervals.push({ workerName, dayKey, ...range });
    });
  };

  if (activeWeekData) {
    Object.entries(activeWeekData.schedule || {}).forEach(([dayKey, day]) => {
      (day?.tasks || []).forEach(task => {
        registerTaskEstimate(dayKey, day.title || dayKey, task.text, task.timeFrame, task.assigned);
      });
    });
    (activeWeekData.saturdaySpecial?.weddings || []).forEach(wedding => {
      registerTaskEstimate('saturdaySpecial', activeWeekData.saturdaySpecial?.title || 'Sábado', wedding.details || wedding.location, wedding.timeFrame, wedding.assigned);
    });
    // "sundayMonday" agrupa DOS días de calendario distintos (domingo y
    // lunes) bajo una sola clave — cada tarea usa su propia sub-clave para
    // no fusionar por error horas de un día con las del otro.
    (activeWeekData.sundayMonday?.tasks || []).forEach((task, idx) => {
      registerTaskEstimate(`sundayMonday_${idx}`, activeWeekData.sundayMonday?.title || 'Domingo/Lunes', task.text, task.timeFrame, task.assigned);
    });
  }

  // Fusiona intervalos solapados por trabajador y día para no contar dos
  // veces el mismo tramo horario (hay solapes conocidos sin resolver, ver PENDIENTES.md).
  const intervalGroups = {};
  estimationIntervals.forEach(({ workerName, dayKey, start, end }) => {
    const key = `${workerName}__${dayKey}`;
    if (!intervalGroups[key]) intervalGroups[key] = { workerName, intervals: [] };
    intervalGroups[key].intervals.push({ start, end });
  });

  const estimatedHoursByWorker = {};
  Object.values(intervalGroups).forEach(({ workerName, intervals }) => {
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      if (sorted[i].start <= last.end) {
        last.end = Math.max(last.end, sorted[i].end);
      } else {
        merged.push({ ...sorted[i] });
      }
    }
    const hours = merged.reduce((acc, m) => acc + (m.end - m.start) / 60, 0);
    estimatedHoursByWorker[workerName] = (estimatedHoursByWorker[workerName] || 0) + hours;
  });

  const estimatedSummary = Object.entries(estimatedHoursByWorker).map(([workerName, hours]) => {
    const workerObj = workersList.find(w => w.name === workerName);
    const isSalaried = workerObj?.isPayroll || workerName === 'Irene' || workerName === 'Raúl';
    const rate = workerObj?.rate || (isSalaried ? 14 : 10);
    return { workerName, hours, isSalaried, rate, cost: isSalaried ? 0 : hours * rate };
  }).sort((a, b) => b.hours - a.hours);

  const filteredEstimatedSummary = filterWorker === 'all'
    ? estimatedSummary
    : estimatedSummary.filter(e => e.workerName === filterWorker);

  const filteredUnestimableTasks = filterWorker === 'all'
    ? unestimableTasks
    : unestimableTasks.filter(t => t.assigned.includes(filterWorker));

  const totalEstimatedExtraHours = filteredEstimatedSummary.reduce((acc, e) => acc + (e.isSalaried ? 0 : e.hours), 0);
  const totalEstimatedExtraCost = filteredEstimatedSummary.reduce((acc, e) => acc + e.cost, 0);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto">
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
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-xl font-bold font-['Outfit']">Informe de Fichajes, Horas & Nóminas</h3>
                <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
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
          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar max-w-full">
            <button
              onClick={() => setViewTab('shifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'shifts' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Jornadas Completadas ({shifts.length})
            </button>
            <button
              onClick={() => setViewTab('raw_entries')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'raw_entries' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚙️ Fichajes Individuales ({entries.length})
            </button>
            <button
              onClick={() => setViewTab('estimated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'estimated' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 Estimado (Planning)
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
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
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
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[620px] text-left text-xs border-collapse">
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

        {/* Tab 3: Estimación a partir del planning (NO fichajes reales) */}
        {viewTab === 'estimated' && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl flex items-start space-x-2.5 text-xs text-amber-300">
              <Calendar className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>
                <b>Es una estimación, no un fichaje real:</b> se calcula a partir del horario planificado de las tareas de esta semana (campo "hora" de cada tarea), no de fichajes de entrada/salida. No se incluye en "Gasto Total Extras" ni "Horas Extras Totales" de arriba — es solo referencia para ver qué se lleva planificado aunque nadie haya fichado todavía.
              </span>
            </div>

            {filteredEstimatedSummary.length === 0 ? (
              <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800">
                <Calendar className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No hay horas estimables para mostrar.</p>
                <p className="text-[11px] text-slate-500 mt-1">Ninguna tarea de esta semana tiene un horario completo (HH:MM - HH:MM) con alguien asignado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Trabajador</th>
                      <th className="py-3 px-3">Tipo / Tarifa</th>
                      <th className="py-3 px-3">Horas Estimadas</th>
                      <th className="py-3 px-3 text-right">Coste Estimado (€)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredEstimatedSummary.map(e => (
                      <tr key={e.workerName} className="hover:bg-slate-950/50 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">{e.workerName}</td>
                        <td className="py-3 px-3">
                          {e.isSalaried ? (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                              Nómina Fija
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                              Extra ({e.rate.toFixed(2)} €/h)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-400">{e.hours.toFixed(1)} h</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400 font-mono text-sm">
                          {e.isSalaried ? '0,00 €' : `${e.cost.toFixed(2)} €`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-800 text-xs font-bold text-white">
                      <td className="py-3 px-3" colSpan={2}>Total estimado (extras)</td>
                      <td className="py-3 px-3 text-emerald-400">{totalEstimatedExtraHours.toFixed(1)} h</td>
                      <td className="py-3 px-3 text-right text-amber-400 font-mono">{totalEstimatedExtraCost.toFixed(2)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {filteredUnestimableTasks.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-slate-300 mb-2">
                  ⚠️ {filteredUnestimableTasks.length} tarea{filteredUnestimableTasks.length === 1 ? '' : 's'} con gente asignada pero sin horario completo (no se ha podido estimar su duración):
                </p>
                <ul className="space-y-1 max-h-40 overflow-y-auto pr-1">
                  {filteredUnestimableTasks.map((t, idx) => (
                    <li key={idx} className="text-[11px] text-slate-400">
                      <span className="text-slate-500">{t.dayLabel}:</span> {t.label} — <span className="text-slate-300">{t.assigned.join(', ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
