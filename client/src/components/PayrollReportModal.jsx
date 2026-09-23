import React, { useState } from 'react';
import { AlertTriangle, Calendar, Check, Clock, Copy, Crown, DollarSign, Edit3, ListChecks, Lock, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import AdminClockEditModal from './AdminClockEditModal';
import { pairShiftsFromEntries, aggregateShiftsByWorker } from '../data/shiftCalculations';
import { horaDeFichaje, fechaDeFichaje } from '../data/fichajes';
import { formatearEuros, formatearHoras } from '../data/formatoFinanciero';
import Modal from './ui/Modal';
import EstadoVacio from './ui/EstadoVacio';
import CabeceraModal from './ui/CabeceraModal';
import { Selector } from './ui/Campo';

export default function PayrollReportModal({
  isOpen,
  onClose,
  entries = [],
  workersList = [],
  onClearEntries,
  isAdmin = true,
  onUpdateEntry,
  onDeleteEntry,
  onRestoreEntry,
  onClockEntryCreated,
  activeWeekData = null
}) {
  const [copied, setCopied] = useState(false);
  const [filterWorker, setFilterWorker] = useState('all');
  const [viewTab, setViewTab] = useState('shifts'); // 'shifts' | 'raw_entries' | 'estimated' | 'trash'
  const [editingEntry, setEditingEntry] = useState(null);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  if (!isOpen) return null;

  const activeEntries = entries.filter(e => !e.deleted);
  const deletedEntries = entries.filter(e => e.deleted);

  // Process shift pairs (Entrada -> Salida)
  const { shifts, activeShifts: activeWorkerShifts } = pairShiftsFromEntries(activeEntries);
  const workerBalances = aggregateShiftsByWorker(shifts, workersList);

  // Extract all aggregated daily shifts from balances
  const allAggregatedShifts = Object.values(workerBalances)
    .flatMap(bucket => bucket.shifts)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate) || a.workerName.localeCompare(b.workerName));

  // Filtered daily shifts
  const filteredShifts = filterWorker === 'all' 
    ? allAggregatedShifts 
    : allAggregatedShifts.filter(s => s.workerName === filterWorker);

  // Filtered raw entries (active only)
  const filteredRawEntries = filterWorker === 'all'
    ? activeEntries
    : activeEntries.filter(e => e.workerName === filterWorker);

  // Filtered trash entries
  const filteredTrashEntries = filterWorker === 'all'
    ? deletedEntries
    : deletedEntries.filter(e => e.workerName === filterWorker);

  // Summary Metrics — se filtran por filterWorker igual que filteredShifts/
  // filteredRawEntries de abajo. Antes de este fix, estas tarjetas siempre
  // mostraban el total de todo el equipo aunque se filtrara por un
  // trabajador concreto en el desplegable.
  let totalExtraCost = 0;
  let totalPayrollValuation = 0;
  let totalExtraHours = 0;

  Object.values(workerBalances)
    .filter(bucket => filterWorker === 'all' || bucket.name === filterWorker)
    .forEach(bucket => {
      if (bucket.isPayroll) {
        totalPayrollValuation += bucket.totalCost;
      } else {
        totalExtraCost += bucket.totalCost;
        totalExtraHours += bucket.totalHours;
      }
    });
  const activeClockedInCount = filterWorker === 'all'
    ? Object.keys(activeWorkerShifts).length
    : (activeWorkerShifts[filterWorker] ? 1 : 0);

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
    // Sin fallback hardcodeado a "Irene"/"Raúl": si mañana cambia quién
    // está en nómina fija, el roster (isPayroll) ya manda solo, sin tocar
    // código. Si alguien no está en el roster actual, se trata como Extra
    // por defecto (más seguro infravalorar el coste interno que asumir
    // nómina de alguien que ya no reconoce la app).
    const isSalaried = !!workerObj?.isPayroll;
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
    summaryText += `💶 *Gasto Total Extras (10€/h):* ${formatearEuros(totalExtraCost)}\n`;
    summaryText += `⭐ *Valoración Interna Nóminas (14€/h):* ${formatearEuros(totalPayrollValuation)}\n`;
    summaryText += `⏱️ *Total Horas Trabajadas:* ${formatearHoras(totalExtraHours)}\n`;
    summaryText += `----------------------------------------\n\n`;

    filteredShifts.forEach(s => {
      summaryText += `👤 *${s.workerName}* (${s.isSalaried ? 'Nómina (Control 14€/h)' : '10€/h'})\n`;
      summaryText += `  • Horario: ${s.startTime} ➔ ${s.endTime} (${s.startDate})\n`;
      summaryText += `  • Duración: ${s.durationFormatted}\n`;
      summaryText += `  • Coste: ${formatearEuros(s.cost)}${s.isSalaried ? ' (Control Interno)' : ''}\n\n`;
    });

    // Sección "Estimado (Planning)" — antes no se incluía en absoluto en el
    // copiado, solo se veía en la pestaña de la pantalla. Igual que ahí, se
    // deja claro que es una estimación a partir del horario planificado, no
    // de fichajes reales, para no confundirla con las cifras de arriba.
    if (filteredEstimatedSummary.length > 0) {
      summaryText += `----------------------------------------\n\n`;
      summaryText += `📅 *ESTIMADO SEGÚN PLANNING (no son fichajes reales)*\n`;
      summaryText += `⏱️ *Horas Estimadas (extras):* ${formatearHoras(totalEstimatedExtraHours)}\n`;
      summaryText += `💶 *Coste Estimado (extras):* ${formatearEuros(totalEstimatedExtraCost)}\n\n`;
      filteredEstimatedSummary.forEach(e => {
        summaryText += `👤 *${e.workerName}* (${e.isSalaried ? 'Nómina Fija' : `${formatearEuros(e.rate)}/h`}): ${formatearHoras(e.hours)}${e.isSalaried ? '' : ` — ${formatearEuros(e.cost)}`}\n`;
      });
      summaryText += `\n`;
    }

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
    <>
      <Modal onCerrar={onClose} ancho="4xl">
        {/* Modal Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <CabeceraModal
            icono={DollarSign}
            titulo="Informe de Fichajes, Horas & Nóminas"
            subtitulo="Control de horas trabajadas y tarificación. Modificación restringida a Administración."
            insignia={
              <span className="px-2 py-0.5 text-[10px] font-extrabold rounded bg-slate-800 text-amber-400 border border-amber-500/30 flex items-center gap-1 shrink-0">
                <Lock className="w-3 h-3 text-amber-400" />
                <span>Fichajes Bloqueados</span>
              </span>
            }
          />

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <button
                onClick={handleOpenCreateNew}
                className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Fichaje Admin</span>
              </button>
            )}

            <button
              onClick={handleCopySummary}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 transition-all whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>¡Resumen Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" />
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
              <Crown className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Modo Admin Activo
            </span>
          ) : (
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-md font-bold shrink-0">
              <Lock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Vista Trabajador
            </span>
          )}
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-amber-500/10 to-transparent p-4 rounded-2xl border border-amber-500/20 shadow-lg shadow-amber-500/5 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
              <DollarSign className="w-16 h-16 text-amber-500" />
            </div>
            <p className="text-xs text-slate-400 font-medium relative z-10">Gasto Total Extras</p>
            <p className="text-3xl font-bold text-amber-400 mt-1 font-['Outfit'] relative z-10">
              {formatearEuros(totalExtraCost)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 relative z-10">Calculado a 10,00 €/h</p>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-4 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
              <Clock className="w-16 h-16 text-emerald-500" />
            </div>
            <p className="text-xs text-slate-400 font-medium relative z-10">Horas Extras Totales</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1 font-['Outfit'] relative z-10">
              {formatearHoras(totalExtraHours)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 relative z-10">{filteredShifts.length} jornadas completadas</p>
          </div>

          <div className="bg-gradient-to-br from-indigo-500/10 to-transparent p-4 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5 relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
              <Crown className="w-16 h-16 text-indigo-500" />
            </div>
            <p className="text-xs text-slate-400 font-medium relative z-10">Val. Interna Nóminas</p>
            <p className="text-3xl font-bold text-indigo-400 mt-1 font-['Outfit'] relative z-10">
              {formatearEuros(totalPayrollValuation)}
            </p>
            <p className="text-[10px] text-slate-500 mt-1 relative z-10 leading-tight">Control interno a 14,00 €/h</p>
          </div>

          <div className="bg-gradient-to-br from-rose-500/10 to-transparent p-4 rounded-2xl border border-rose-500/20 shadow-lg shadow-rose-500/5 relative overflow-hidden group hover:border-rose-500/40 transition-colors">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-300">
              <Lock className="w-16 h-16 text-rose-500" />
            </div>
            <p className="text-xs text-slate-400 font-medium relative z-10">Trabajadores en Turno</p>
            <p className="text-3xl font-bold text-rose-400 mt-1 font-['Outfit'] relative z-10">
              {activeClockedInCount} <span className="text-lg font-medium text-rose-400/70">activos</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-1 relative z-10 leading-tight">Fichaje de entrada abierto</p>
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
              <ListChecks className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Fichajes Individuales ({entries.length})
            </button>
            <button
              onClick={() => setViewTab('estimated')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                viewTab === 'estimated' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Estimado (Planning)
            </button>
            {isAdmin && (
              <button
                onClick={() => setViewTab('trash')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  viewTab === 'trash' ? 'bg-rose-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Papelera ({deletedEntries.length})
              </button>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">Trabajador:</span>
            <Selector value={filterWorker} onChange={(e) => setFilterWorker(e.target.value)} tamano="2xs" className="">
              <option value="all">Todos ({workersList.length})</option>
              {workersList.map(w => (
                <option key={w.name} value={w.name}>{w.name}</option>
              ))}
            </Selector>

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
            <EstadoVacio icono={Clock} titulo="No hay registros de jornadas completadas para mostrar." detalle="Los fichajes se calculan cuando un trabajador ficha su entrada y salida." />
          ) : (
            <>
              {/* Mobile Card Layout (sm:hidden) */}
              <div className="block sm:hidden space-y-2.5">
                {filteredShifts.map((s) => (
                  <div key={s.id} className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-sm truncate">{s.workerName}</span>
                      {s.isSalaried ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold shrink-0">
                          Nómina Fija
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0">
                          Extra (10,00 €/h)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div className="bg-slate-900/60 rounded-lg p-2.5">
                        <span className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">📅 {s.startDate}</span>
                        {s.ranges && s.ranges.map((r, i) => (
                          <div key={i} className="text-slate-200 font-mono text-[11px] flex items-center gap-1.5 mb-1 bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/60">
                            <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{r.replace(' a ', ' ➔ ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/60">
                      <span className="font-semibold text-emerald-400">{formatearHoras(s.durationHours)} totales</span>
                      <span className="font-bold text-amber-400 font-mono text-sm">
                        {s.isSalaried ? formatearEuros(0) : formatearEuros(s.cost)}
                      </span>
                    </div>

                    {isAdmin ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleOpenEdit(s.startEntry)}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-colors"
                          title="Editar Fichaje de Entrada (Admin)"
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          <span>Editar Entrada</span>
                        </button>
                        <button
                          onClick={() => handleOpenEdit(s.endEntry)}
                          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition-colors"
                          title="Editar Fichaje de Salida (Admin)"
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" />
                          <span>Editar Salida</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-slate-400 font-medium">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Bloqueado</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto no-scrollbar">
                <table className="w-full min-w-[680px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Trabajador</th>
                      <th className="py-3 px-3">Tipo / Tarifa</th>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Tramos / Horarios</th>
                      <th className="py-3 px-3">Horas Totales</th>
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
                        <td className="py-3 px-3 text-slate-300 font-medium">
                          {s.startDate}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          <div className="flex flex-col gap-1">
                            {s.ranges && s.ranges.map((r, i) => (
                              <div key={i} className="inline-flex items-center gap-1.5 bg-slate-950/60 border border-slate-800/60 px-2 py-1 rounded-md w-max text-[11px]">
                                <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{r.replace(' a ', ' ➔ ')}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className={`font-semibold ${s.isAnomalous ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {formatearHoras(s.durationHours)} totales
                          </div>
                          {s.isAnomalous && (
                            <div className="text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1 py-0.5 rounded mt-1 inline-flex items-center gap-1" title="El sistema ha capado este turno a 14h automáticamente por seguridad. Revisa las horas reales.">
                              <AlertTriangle className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Capado 14h
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400 font-mono text-sm">
                          {s.isSalaried ? formatearEuros(0) : formatearEuros(s.cost)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isAdmin ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEdit(s.startEntry)}
                                className="flex items-center gap-1 px-2 h-9 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors"
                                title="Editar Fichaje de Entrada (Admin)"
                              >
                                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[10px] font-bold">Entrada</span>
                              </button>
                              <button
                                onClick={() => handleOpenEdit(s.endEntry)}
                                className="flex items-center gap-1 px-2 h-9 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                                title="Editar Fichaje de Salida (Admin)"
                              >
                                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-[10px] font-bold">Salida</span>
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
            </>
          )
        )}

        {/* Tab 2: Raw Individual Entries (Listado Completo & Edición Admin) */}
        {viewTab === 'raw_entries' && (
          filteredRawEntries.length === 0 ? (
            <EstadoVacio icono={Clock} titulo="No hay fichajes individuales registrados." />
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
                        <div>
                          {horaDeFichaje(entry)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fechaDeFichaje(entry)}
                        </div>
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
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-2">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => handleOpenEdit(entry)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center space-x-1"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm('¿Seguro que quieres borrar este fichaje? Irá a la papelera.')) {
                                    if (onDeleteEntry) onDeleteEntry(entry.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                                title="Enviar a la Papelera"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center justify-center space-x-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Bloqueado</span>
                            </span>
                          )}
                        </div>
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
              <EstadoVacio icono={Calendar} titulo="No hay horas estimables para mostrar." detalle="Ninguna tarea de esta semana tiene un horario completo (HH:MM - HH:MM) con alguien asignado." />
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
                              Extra ({formatearEuros(e.rate)}/h)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-emerald-400">{formatearHoras(e.hours)}</td>
                        <td className="py-3 px-3 text-right font-bold text-amber-400 font-mono text-sm">
                          {e.isSalaried ? formatearEuros(0) : formatearEuros(e.cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-800 text-xs font-bold text-white">
                      <td className="py-3 px-3" colSpan={2}>Total estimado (extras)</td>
                      <td className="py-3 px-3 text-emerald-400">{formatearHoras(totalEstimatedExtraHours)}</td>
                      <td className="py-3 px-3 text-right text-amber-400 font-mono">{formatearEuros(totalEstimatedExtraCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {filteredUnestimableTasks.length > 0 && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
                <p className="text-[11px] font-semibold text-slate-300 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{filteredUnestimableTasks.length} tarea{filteredUnestimableTasks.length === 1 ? '' : 's'} con gente asignada pero sin horario completo (no se ha podido estimar su duración):
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

        {/* Tab 4: Papelera (Solo Admin) */}
        {viewTab === 'trash' && isAdmin && (
          <div className="space-y-4">
            <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl flex items-start space-x-2.5 text-xs text-rose-300">
              <Trash2 className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>
                <b>Fichajes Borrados:</b> Estos fichajes fueron eliminados y ya no se contabilizan en los saldos. Puedes restaurarlos si fue un error.
              </span>
            </div>

            {filteredTrashEntries.length === 0 ? (
              <EstadoVacio icono={Trash2} titulo="La papelera está vacía." colorIcono="text-slate-600" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Hora / Fecha</th>
                      <th className="py-3 px-3">Trabajador</th>
                      <th className="py-3 px-3">Tipo</th>
                      <th className="py-3 px-3">Tarea / Nota</th>
                      <th className="py-3 px-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredTrashEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors opacity-70">
                        <td className="py-3 px-3 text-slate-200 font-mono">
                          <div>
                            {horaDeFichaje(entry)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {fechaDeFichaje(entry)}
                          </div>
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
                        <td className="py-3 px-3 text-slate-300">
                          <div className="font-medium text-white">{entry.taskName}</div>
                          {entry.note && (
                            <div className="text-[10px] text-amber-300/80 mt-0.5 italic flex items-center gap-1">
                              <span>💬</span> {entry.note}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => {
                              if (window.confirm('¿Restaurar este fichaje a los saldos activos?')) {
                                onRestoreEntry && onRestoreEntry(entry.id);
                              }
                            }}
                            className="flex items-center gap-1 px-3 h-8 mx-auto rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors font-bold text-[10px]"
                          >
                            Restaurar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Admin Clock Edit Modal */}
      <AdminClockEditModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        entry={editingEntry}
        pairedEntry={(() => {
          if (!editingEntry) return null;
          for (const shift of shifts) {
            if (shift.startEntry.id === editingEntry.id) return shift.endEntry;
            if (shift.endEntry.id === editingEntry.id) return shift.startEntry;
          }
          return null;
        })()}
        workersList={workersList}
        onUpdateEntry={onUpdateEntry}
        onDeleteEntry={onDeleteEntry}
        onClockEntryCreated={onClockEntryCreated}
      />
    </>
  );
}
