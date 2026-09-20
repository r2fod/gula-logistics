import React, { useState } from 'react';
import { TrendingUp, Share2, Bus, Clock, ChevronUp, ChevronDown, Trash2, Plus, MessageCircle } from 'lucide-react';

export default function TeamBalancesTab({
  balancesData,
  onOpenShareModal,
  adminUnlocked,
  onDeleteClockEntry,
  persistWorkerBalance,
  findWorkerHours
}) {
  const [expandedWorkerId, setExpandedWorkerId] = useState('jefferson');
  const [addingConceptFor, setAddingConceptFor] = useState(null);
  const [newConceptMode, setNewConceptMode] = useState('turno');
  const [newConceptText, setNewConceptText] = useState('');
  const [newConceptAmount, setNewConceptAmount] = useState('');
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [savingBalanceId, setSavingBalanceId] = useState(null);

  const parseHM = (hm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const parseSpanishDate = (str) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str || '').trim());
    if (!m) return null;
    return { day: parseInt(m[1], 10), month: parseInt(m[2], 10), year: parseInt(m[3], 10) };
  };

  // Riesgo de doble contabilidad: si ya hay fichajes reales de este
  // trabajador ese mismo día, un concepto/turno metido a mano para la
  // MISMA fecha se sumaría por duplicado (una vez aquí, otra vez ya
  // calculado automáticamente sobre los fichajes). No se puede bloquear —
  // a veces es un concepto legítimo aparte (ej. una rotura, un adelanto)
  // que solo coincide en fecha por casualidad — así que solo se avisa,
  // la decisión final la toma quien lo está guardando.
  const hasRealShiftOnDate = (worker, isoDateStr) => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDateStr || '');
    if (!iso) return false;
    const target = { day: parseInt(iso[3], 10), month: parseInt(iso[2], 10), year: parseInt(iso[1], 10) };
    const shifts = findWorkerHours(worker.name)?.shifts || [];
    return shifts.some(s => {
      const d = parseSpanishDate(s.startDate);
      return d && d.day === target.day && d.month === target.month && d.year === target.year;
    });
  };

  const computeShiftPreview = (worker) => {
    const startMin = parseHM(newShiftStart);
    const endMin = parseHM(newShiftEnd);
    if (startMin === null || endMin === null || !newShiftDate) return null;

    let diffMin = endMin - startMin;
    if (diffMin <= 0) diffMin += 24 * 60;
    const hours = diffMin / 60;

    const dateObj = new Date(`${newShiftDate}T00:00:00`);
    const dateLabel = Number.isNaN(dateObj.getTime())
      ? newShiftDate
      : `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const fmtHours = (h) => (Number.isInteger(h) ? `${h}` : parseFloat(h.toFixed(2)).toString());

    if (worker.isSpecialPurse && worker.purseInfo) {
      const p = worker.purseInfo;
      const remaining = Math.max(0, p.totalHours - p.consumedHours);
      const purseHours = Math.min(hours, remaining);
      const extraHours = Math.max(0, hours - purseHours);
      const amount = purseHours * p.hourlyRate + extraHours * p.extraRateAfter80h;

      let concept;
      if (extraHours === 0) {
        concept = `🕒 ${dateLabel} (${newShiftStart} a ${newShiftEnd} - ${fmtHours(hours)}h a ${p.hourlyRate}€/h · Bolsa)`;
      } else if (purseHours === 0) {
        concept = `🕒 ${dateLabel} (${newShiftStart} a ${newShiftEnd} - ${fmtHours(hours)}h a ${p.extraRateAfter80h}€/h · Extra tras bolsa)`;
      } else {
        concept = `🕒 ${dateLabel} (${newShiftStart} a ${newShiftEnd} - ${fmtHours(purseHours)}h a ${p.hourlyRate}€/h + ${fmtHours(extraHours)}h a ${p.extraRateAfter80h}€/h)`;
      }

      return { hours, purseHours, extraHours, amount, concept, dateLabel, isPurse: true };
    }

    const rate = worker.hourlyRate || (worker.statusType === 'payroll' ? 14 : 10);
    const amount = hours * rate;
    const concept = `🕒 ${dateLabel} (${newShiftStart} a ${newShiftEnd} - ${fmtHours(hours)}h a ${rate}€/h)`;

    return { hours, rate, amount, concept, dateLabel, isPurse: false };
  };

  const resetAddConceptForm = () => {
    setAddingConceptFor(null);
    setNewConceptText('');
    setNewConceptAmount('');
    setNewShiftDate('');
    setNewShiftStart('');
    setNewShiftEnd('');
  };

  const handleAddShift = async (worker) => {
    const preview = computeShiftPreview(worker);
    if (!preview) return;
    setSavingBalanceId(worker.id);

    try {
      if (!preview.isPurse) {
        const newItem = { concept: preview.concept, amount: preview.amount, isPositive: true };
        const newBreakdown = [...(worker.breakdown || []), newItem];
        const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);

        await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
        resetAddConceptForm();
        return;
      }

      let newBreakdown = [...(worker.breakdown || [])];
      const updates = {};
      const p = worker.purseInfo;

      if (preview.purseHours > 0) {
        const newConsumedHours = p.consumedHours + preview.purseHours;
        const newConsumedValue = newConsumedHours * p.hourlyRate;
        updates.purseInfo = {
          ...p,
          consumedHours: newConsumedHours,
          consumedValue: newConsumedValue,
          remainingHoursForExtra: Math.max(0, p.totalHours - newConsumedHours),
          shifts: [...(p.shifts || []), { date: preview.dateLabel, hours: preview.purseHours, range: `${newShiftStart} a ${newShiftEnd}` }]
        };

        const bolsaLine = {
          concept: `Valor Acumulado Horas Bolsa (${newConsumedHours}h a ${p.hourlyRate}€/h)`,
          amount: newConsumedValue,
          isPositive: true
        };
        const bolsaLineIdx = newBreakdown.findIndex(it => it.concept.startsWith('Valor Acumulado Horas Bolsa'));
        if (bolsaLineIdx !== -1) newBreakdown[bolsaLineIdx] = bolsaLine;
        else newBreakdown = [bolsaLine, ...newBreakdown];
      }

      if (preview.extraHours > 0) {
        const hoursLabel = Number.isInteger(preview.extraHours) ? `${preview.extraHours}` : parseFloat(preview.extraHours.toFixed(2)).toString();
        newBreakdown.push({
          concept: `🕒 ${preview.dateLabel} (${newShiftStart} a ${newShiftEnd} - ${hoursLabel}h a ${p.extraRateAfter80h}€/h · Extra tras bolsa)`,
          amount: preview.extraHours * p.extraRateAfter80h,
          isPositive: true
        });
      }

      updates.breakdown = newBreakdown;
      updates.currentBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);

      await persistWorkerBalance(worker.id, updates);
      resetAddConceptForm();
    } finally {
      setSavingBalanceId(null);
    }
  };

  const handleAddConcept = async (worker, overrideAmount = null) => {
    const amount = overrideAmount !== null ? overrideAmount : parseFloat(newConceptAmount.replace(',', '.'));
    if (!newConceptText.trim() || Number.isNaN(amount)) return;
    setSavingBalanceId(worker.id);

    try {
      const newItem = { concept: newConceptText.trim(), amount, isPositive: amount >= 0 };
      const newBreakdown = [...(worker.breakdown || []), newItem];
      const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);

      await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
      resetAddConceptForm();
    } finally {
      setSavingBalanceId(null);
    }
  };

  const handleDeleteConcept = async (worker, idx) => {
    setSavingBalanceId(worker.id);
    try {
      const newBreakdown = (worker.breakdown || []).filter((_, i) => i !== idx);
      const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);
      await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
    } finally {
      setSavingBalanceId(null);
    }
  };

  const handleDeleteDynamicShift = async (entryIds) => {
    if (window.confirm('¿Estás seguro de que quieres borrar este fichaje? Esta acción eliminará los registros de entrada y salida asociados.')) {
      if (onDeleteClockEntry) {
        for (const id of entryIds) {
          await onDeleteClockEntry(id);
        }
      }
    }
  };

  const handleSendWhatsApp = (worker) => {
    let message = `🚚 *Gula Logística — Estado de Saldo & Acuerdos*\n\n`;
    message += `👤 *Trabajador:* ${worker.name}\n`;
    message += `📋 *Rol:* ${worker.role}\n`;

    if (worker.statusType === 'payroll') {
      message += `📌 *Estado:* Nómina Fija (Control interno a 14,00 €/h)\n`;
    } else {
      const balanceStr = worker.currentBalance >= 0 
        ? `+${worker.currentBalance.toFixed(2)} €` 
        : `${worker.currentBalance.toFixed(2)} €`;
      message += `💰 *Saldo Actual:* ${balanceStr}\n\n`;

      if (worker.isSpecialPurse && worker.purseInfo) {
        const p = worker.purseInfo;
        message += `📦 *Bolsa Mensual (80h):*\n`;
        message += `• Base: ${p.grossBase.toFixed(2)} € - Alojamiento ${p.housingDeduction.toFixed(2)} € = ${p.netFixedAt80h.toFixed(2)} € Neto al cumplir 80h\n`;
        message += `• Horas consumidas hasta hoy: ${p.consumedHours}h (Valor: ${p.consumedValue.toFixed(2)} €)\n`;
        message += `• Horas pendientes para extra a 10€/h: ${p.remainingHoursForExtra}h\n\n`;
      }

      message += `📝 *Desglose de Turnos & Conceptos:*\n`;
      worker.breakdown.forEach(item => {
        const sign = item.amount >= 0 ? '+' : '';
        message += `• ${item.concept}: *${sign}${item.amount.toFixed(2)} €*\n`;
      });
    }

    if (worker.notes) {
      message += `\n💡 *Notas:* ${worker.notes}`;
    }

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span>Control de Saldos & Acuerdos de Personal</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Desglose individual de turnos, bolsas de horas, roturas de vajilla y botones de WhatsApp.
              </p>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              <button
                onClick={onOpenShareModal}
                className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>🔗 Generar Enlaces (WhatsApp)</span>
              </button>

              <span className="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-2 rounded-xl border border-slate-800 hidden md:inline">
                Actualizado: {balancesData.lastUpdated || '—'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(balancesData.workers || []).map((worker) => {
              const isExpanded = expandedWorkerId === worker.id;

              const hours = findWorkerHours(worker.name);
              let dynamicCost = 0;
              let dynamicShifts = [];
              // Arranca desde lo YA consumido de la bolsa (turnos metidos a
              // mano, persistido en purseInfo.consumedHours) — si empezara
              // siempre en 0, un trabajador con la bolsa ya agotada por
              // turnos manuales seguiría pagando sus fichajes automáticos a
              // la tarifa base de bolsa en vez de a la tarifa extra que le
              // corresponde una vez superadas las horas de la bolsa.
              let consumedBolsa = worker.purseInfo?.consumedHours || 0;

              if (hours && hours.shifts && hours.shifts.length > 0) {
                hours.shifts.forEach(s => {
                  let computedCost = 0;
                  let computedConcept = '';
                  const fmtHours = (h) => (Number.isInteger(h) ? `${h}` : parseFloat(h.toFixed(2)).toString());

                  const timeRangeText = s.ranges ? s.ranges.join(' y ') : `${s.startTime} a ${s.endTime}`;

                  if (worker.isSpecialPurse && worker.purseInfo) {
                    const p = worker.purseInfo;
                    const remaining = Math.max(0, p.totalHours - consumedBolsa);
                    const purseHours = Math.min(s.durationHours, remaining);
                    const extraHours = Math.max(0, s.durationHours - purseHours);
                    computedCost = purseHours * p.hourlyRate + extraHours * p.extraRateAfter80h;
                    
                    if (extraHours === 0) {
                      computedConcept = `🕒 ${s.startDate} [${timeRangeText}] - ${fmtHours(s.durationHours)}h a ${p.hourlyRate}€/h (Bolsa)`;
                    } else if (purseHours === 0) {
                      computedConcept = `🕒 ${s.startDate} [${timeRangeText}] - ${fmtHours(s.durationHours)}h a ${p.extraRateAfter80h}€/h (Extra)`;
                    } else {
                      computedConcept = `🕒 ${s.startDate} [${timeRangeText}] - ${fmtHours(purseHours)}h a ${p.hourlyRate}€/h + ${fmtHours(extraHours)}h a ${p.extraRateAfter80h}€/h`;
                    }
                    consumedBolsa += s.durationHours;
                  } else {
                    computedCost = s.cost;
                    computedConcept = `🕒 ${s.startDate} [${timeRangeText}] - ${fmtHours(s.durationHours)}h a ${s.rate}€/h`;
                  }

                  dynamicCost += computedCost;
                  dynamicShifts.push({
                    concept: computedConcept,
                    amount: computedCost,
                    isDynamic: true,
                    entryIds: s.entryIds || [],
                    timestamp: s.startEntry?.timestamp || s.startDate || 0
                  });
                });
              }
              
              const displayBalance = worker.currentBalance + dynamicCost;
              const derivedStatusType = worker.statusType === 'payroll' 
                ? 'payroll'
                : (displayBalance > 0 ? 'success' : (displayBalance < 0 ? 'danger' : 'neutral'));

              return (
                <div 
                  key={worker.id}
                  className={`border rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between space-y-4 ${
                    derivedStatusType === 'danger'
                      ? 'border-rose-500/40 bg-gradient-to-br from-slate-800 via-slate-800 to-rose-900/30'
                      : derivedStatusType === 'payroll'
                      ? 'border-indigo-500/40 bg-slate-800'
                      : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {worker.avatar}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-white text-lg font-['Outfit']">{worker.name}</h4>
                            {derivedStatusType === 'success' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                🟢 A favor
                              </span>
                            )}
                            {derivedStatusType === 'danger' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                🔴 Deuda Pendiente
                              </span>
                            )}
                            {derivedStatusType === 'payroll' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ⭐ Nómina Fija
                              </span>
                            )}
                            {derivedStatusType === 'neutral' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                ⚪ Sin Saldo
                              </span>
                            )}
                            {worker.hasTransportBonus && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                                <Bus className="w-3 h-3" />
                                <span>+10€ transport/día</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{worker.role}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                          {worker.statusType === 'payroll' ? 'Coste Extra' : 'Saldo Actual'}
                        </span>
                        {worker.statusType === 'payroll' ? (
                          <span className="text-xl font-extrabold text-amber-400 font-mono">0,00 €</span>
                        ) : (
                          <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                            displayBalance > 0 ? 'text-emerald-400' : displayBalance < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {displayBalance >= 0 ? `+${displayBalance.toFixed(2)} €` : `${displayBalance.toFixed(2)} €`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Horas reales fichadas sumadas al balance */}
                    {hours && hours.completedShifts > 0 && (
                      <div className="mt-3 flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-emerald-100">
                          <b className="text-emerald-400 font-mono">{parseFloat(hours.totalHours.toFixed(2))}h</b> fichadas automáticamente y sumadas al saldo
                        </span>
                      </div>
                    )}

                    {/* Special Jefferson Purse Box */}
                    {worker.isSpecialPurse && worker.purseInfo && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-amber-300 flex items-center space-x-1">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>Bolsa Mensual (80h)</span>
                          </span>
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                            {Math.round((worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100)}% Consumido
                          </span>
                        </div>

                        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-amber-500/20">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                            style={{ width: `${(worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100}%` }}
                          ></div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Condición Base:</span>
                            <span className="font-semibold text-white">
                              {worker.purseInfo.totalHours}h ({worker.purseInfo.grossBase.toFixed(0)}€ - {worker.purseInfo.housingDeduction.toFixed(0)}€ Aloj.) = <b>{worker.purseInfo.netFixedAt80h.toFixed(0)}€ Neto</b>
                            </span>
                          </div>
                          <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Acumulado Septiembre:</span>
                            <span className="font-bold text-emerald-400">{worker.purseInfo.consumedHours}h ({worker.purseInfo.consumedValue.toFixed(2)}€)</span>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedWorkerId(isExpanded ? null : worker.id)}
                          className="w-full py-1 text-center text-xs text-amber-400 font-semibold flex items-center justify-center space-x-1"
                        >
                          <span>{isExpanded ? 'Ocultar turnos bolsa' : `Ver turnos consumidos (${worker.purseInfo.consumedHours}h)`}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="pt-2 border-t border-amber-500/20 space-y-1 text-xs text-slate-300">
                            {worker.purseInfo.shifts.map((s, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg">
                                  <span className="break-words min-w-0 flex-1 pr-2">📅 <b>{s.date}</b> ({s.range})</span>
                                  <span className="font-bold text-amber-400 shrink-0">{s.hours}h</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agreements */}
                    {worker.agreements && worker.agreements.length > 0 && (
                      <div className="mt-3.5 p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-amber-400/90 uppercase tracking-wider block">
                          📜 Acuerdos & Condiciones
                        </span>
                        {worker.agreements.map((agr, aIdx) => (
                          <p key={aIdx} className="text-xs text-slate-300 flex items-start gap-1.5 leading-snug">
                            <span className="text-amber-400 text-xs leading-4">•</span>
                            <span>{agr}</span>
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Breakdown */}
                    <div className="mt-4 space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Desglose de Conceptos & Turnos
                      </span>
                      <div className={`space-y-1.5 pr-1 ${(worker.breakdown || []).length + dynamicShifts.length > 5 ? 'max-h-[32rem] overflow-y-auto custom-scrollbar' : ''}`}>
                        {[...dynamicShifts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)), ...(worker.breakdown || [])].map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              item.amount < 0
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                                : item.isDynamic
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'
                                : 'bg-slate-800/80 border-slate-700 text-slate-200'
                            }`}
                          >
                            <span className="font-medium break-words min-w-0 flex-1 pr-2">{item.concept}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold font-mono ${
                                item.amount > 0 ? 'text-emerald-400' : item.amount < 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}>
                                {item.amount > 0 ? `+${item.amount.toFixed(2)} €` : item.amount < 0 ? `${item.amount.toFixed(2)} €` : '0,00 €'}
                              </span>
                              {adminUnlocked && (
                                <button
                                  onClick={() => item.isDynamic ? handleDeleteDynamicShift(item.entryIds) : handleDeleteConcept(worker, idx - dynamicShifts.length)}
                                  disabled={savingBalanceId === worker.id}
                                  className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                                  title={item.isDynamic ? "Borrar jornada fichada" : "Eliminar concepto manual"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {adminUnlocked && (
                        addingConceptFor === worker.id ? (
                          <div className="p-3 rounded-xl border border-amber-500/30 bg-slate-950/80 space-y-2.5">
                            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 space-x-1">
                              <button
                                onClick={() => setNewConceptMode('turno')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                  newConceptMode === 'turno' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                🕒 Turno
                              </button>
                              <button
                                onClick={() => setNewConceptMode('manual')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                  newConceptMode === 'manual' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                ✏️ Ajuste
                              </button>
                              <button
                                onClick={() => setNewConceptMode('pago')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                  newConceptMode === 'pago' ? 'bg-rose-500 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                💸 Adelanto
                              </button>
                            </div>

                            {newConceptMode === 'turno' ? (
                              (() => {
                                const preview = computeShiftPreview(worker);
                                return (
                                  <>
                                    <input
                                      type="date"
                                      value={newShiftDate}
                                      onChange={(e) => setNewShiftDate(e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                                    />
                                    <div className="flex gap-2">
                                      <input
                                        type="time"
                                        value={newShiftStart}
                                        onChange={(e) => setNewShiftStart(e.target.value)}
                                        placeholder="Entrada"
                                        className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                                      />
                                      <input
                                        type="time"
                                        value={newShiftEnd}
                                        onChange={(e) => setNewShiftEnd(e.target.value)}
                                        placeholder="Salida"
                                        className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                                      />
                                    </div>
                                    {preview && (
                                      <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 font-mono">
                                        {preview.concept} → <b>+{preview.amount.toFixed(2)} €</b>
                                      </div>
                                    )}
                                    {preview && hasRealShiftOnDate(worker, newShiftDate) && (
                                      <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                                        ⚠️ Ya hay fichajes reales de {worker.name} ese mismo día — si son las mismas horas, esto las sumaría por duplicado. Revisa el desglose antes de guardar.
                                      </div>
                                    )}
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleAddShift(worker)}
                                        disabled={savingBalanceId === worker.id || !preview}
                                        className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
                                      >
                                        {savingBalanceId === worker.id ? 'Guardando...' : 'Guardar'}
                                      </button>
                                      <button
                                        onClick={resetAddConceptForm}
                                        className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </>
                                );
                              })()
                            ) : newConceptMode === 'manual' ? (
                              <>
                                <input
                                  type="text"
                                  value={newConceptText}
                                  onChange={(e) => setNewConceptText(e.target.value)}
                                  placeholder="Concepto (ej: Plus puntualidad)"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={newConceptAmount}
                                  onChange={(e) => setNewConceptAmount(e.target.value)}
                                  placeholder="Importe a SUMAR (ej: 20.00)"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddConcept(worker)}
                                    disabled={savingBalanceId === worker.id || !newConceptAmount || isNaN(parseFloat(newConceptAmount.replace(',','.')))}
                                    className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all disabled:opacity-50"
                                  >
                                    {savingBalanceId === worker.id ? 'Guardando...' : 'Añadir Importe'}
                                  </button>
                                  <button
                                    onClick={resetAddConceptForm}
                                    className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={newConceptText}
                                  onChange={(e) => setNewConceptText(e.target.value)}
                                  placeholder="Concepto (ej: Adelanto nómina, Pago Bizum)"
                                  className="w-full bg-slate-900 border border-rose-900/50 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500"
                                />
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={newConceptAmount}
                                  onChange={(e) => setNewConceptAmount(e.target.value)}
                                  placeholder="Importe a RESTAR (se pondrá en negativo)"
                                  className="w-full bg-slate-900 border border-rose-900/50 rounded-lg p-2 text-xs text-rose-400 focus:outline-none focus:border-rose-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      // Asegurarnos de que el importe sea negativo
                                      let val = parseFloat(newConceptAmount.replace(',', '.'));
                                      if (!isNaN(val)) {
                                        val = Math.abs(val) * -1; // Fuerza negativo
                                        handleAddConcept(worker, val);
                                      }
                                    }}
                                    disabled={savingBalanceId === worker.id || !newConceptAmount || isNaN(parseFloat(newConceptAmount.replace(',','.')))}
                                    className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all disabled:opacity-50 shadow-md shadow-rose-600/20"
                                  >
                                    {savingBalanceId === worker.id ? 'Guardando...' : 'Registrar Adelanto'}
                                  </button>
                                  <button
                                    onClick={resetAddConceptForm}
                                    className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingConceptFor(worker.id);
                              setNewShiftDate(new Date().toISOString().slice(0, 10));
                            }}
                            className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-amber-500/50 text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Añadir concepto / horas manual</span>
                          </button>
                        )
                      )}
                    </div>

                    {/* Worker Notes */}
                    {worker.notes && (
                      <div className="mt-2.5 px-2 py-1.5 rounded-xl bg-slate-950/40 border border-slate-800/60">
                        <p className="text-[11px] text-slate-400 italic">
                          💡 {worker.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
                    <button
                      onClick={() => handleSendWhatsApp(worker)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Redactar WhatsApp</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      
  );
}
