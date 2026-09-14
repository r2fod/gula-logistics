import React, { useState } from 'react';
import { DollarSign, Clock, Users, X, Copy, Check, Trash2, Calendar, FileText, Download } from 'lucide-react';

export default function PayrollReportModal({ 
  isOpen, 
  onClose, 
  entries = [], 
  workersList = [], 
  onClearEntries 
}) {
  const [copied, setCopied] = useState(false);
  const [filterWorker, setFilterWorker] = useState('all');

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

  // Summary Metrics
  const totalExtraCost = shifts.reduce((acc, curr) => acc + (curr.isSalaried ? 0 : curr.cost), 0);
  const totalPayrollValuation = shifts.reduce((acc, curr) => acc + (curr.isSalaried ? curr.cost : 0), 0);
  const totalExtraHours = shifts.reduce((acc, curr) => acc + curr.durationHours, 0);
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-['Outfit']">Informe de Fichajes, Horas & Nóminas</h3>
              <p className="text-xs text-slate-400">Control de horas trabajadas y tarificación por extra (10€/h)</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
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
                  <span>Copiar Resumen WhatsApp</span>
                </>
              )}
            </button>
          </div>
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

        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-300">Filtrar por Trabajador:</span>
            <select
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Todos los trabajadores ({shifts.length})</option>
              {workersList.map(w => (
                <option key={w.name} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          {entries.length > 0 && (
            <button
              onClick={onClearEntries}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Resetear Fichajes</span>
            </button>
          )}
        </div>

        {/* Table of Shifts */}
        {filteredShifts.length === 0 ? (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
