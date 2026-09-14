import React, { useState } from 'react';
import { 
  ShieldCheck, 
  DollarSign, 
  Users, 
  Truck, 
  Calendar, 
  X, 
  Lock, 
  Copy, 
  Check, 
  FileText, 
  Activity, 
  Clock, 
  TrendingUp, 
  Award,
  Sparkles,
  MessageCircle,
  Bus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { initialBalancesData } from '../data/balancesData';

export default function PartnerDashboardModal({ 
  isOpen, 
  onClose, 
  entries = [], 
  workersList = [], 
  activeWeekData 
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('balances'); // Default to balances view matching user request!
  const [expandedWorkerId, setExpandedWorkerId] = useState('jefferson');

  if (!isOpen) return null;

  const handleSendWhatsApp = (worker) => {
    let message = `🚚 *Gula Logística — Estado de Saldo & Acuerdos*\n\n`;
    message += `👤 *Trabajador:* ${worker.name}\n`;
    message += `📋 *Rol:* ${worker.role}\n`;

    if (worker.statusType === 'payroll') {
      message += `📌 *Estado:* Nómina Fija (Sin costes por horas extras)\n`;
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

  // Process shift entries to calculate balances per worker
  const workerBalances = {};

  workersList.forEach(w => {
    workerBalances[w.name] = {
      name: w.name,
      role: w.role,
      avatar: w.avatar,
      isPayroll: w.isPayroll,
      rate: w.rate || 10,
      totalHours: 0,
      totalCost: 0,
      completedShifts: 0
    };
  });

  const activeShifts = {};

  entries.forEach(entry => {
    const { workerName, type, timestamp, isPayroll, rate } = entry;
    if (!workerBalances[workerName]) return;

    if (type === 'entrada') {
      activeShifts[workerName] = entry;
    } else if (type === 'salida' && activeShifts[workerName]) {
      const startEntry = activeShifts[workerName];
      delete activeShifts[workerName];

      const startDate = new Date(startEntry.timestamp);
      const endDate = new Date(timestamp);
      const diffMs = endDate - startDate;
      const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));

      const isSalaried = isPayroll || workerName === 'Irene' || workerName === 'Raúl';
      const hourlyRate = rate || (isSalaried ? 14 : 10);
      const cost = diffHours * hourlyRate;

      workerBalances[workerName].totalHours += diffHours;
      workerBalances[workerName].totalCost += cost;
      workerBalances[workerName].completedShifts += 1;
    }
  });

  const balancesList = Object.values(workerBalances);
  const totalExtraExpense = balancesList.reduce((acc, curr) => acc + (curr.isPayroll ? 0 : curr.totalCost), 0);
  const totalPayrollValuation = balancesList.reduce((acc, curr) => acc + (curr.isPayroll ? curr.totalCost : 0), 0);
  const totalExtraHours = balancesList.reduce((acc, curr) => acc + curr.totalHours, 0);

  const getSecurePartnerLink = () => {
    return `${window.location.origin}${window.location.pathname}?role=socias&key=socias2026`;
  };

  const handleCopySecureLink = () => {
    navigator.clipboard.writeText(getSecurePartnerLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const shareSecureLinkWhatsApp = () => {
    const link = getSecurePartnerLink();
    const text = `🔒 Hola Socias, aquí tenéis el Enlace Seguro del Panel Ejecutivo de Gula Logística (Planificación + Saldos de Horas): ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-bold font-['Outfit']">Panel Ejecutivo de Socias</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950 flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>ENLACE SEGURO</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">Visión de Dirección: Logística en vivo & Saldos acumulados</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={handleCopySecureLink}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-slate-700 transition-all"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Link Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Link Seguro</span>
                </>
              )}
            </button>

            <button
              onClick={shareSecureLinkWhatsApp}
              className="flex-1 sm:flex-none py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Socias</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'financial'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>💶 Resumen Financiero & Extras</span>
          </button>

          <button
            onClick={() => setActiveTab('balances')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'balances'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>📜 Saldos & Acuerdos Detallados</span>
          </button>

          <button
            onClick={() => setActiveTab('logistics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'logistics'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>🚚 Resumen de Flota y Bodas</span>
          </button>
        </div>

        {/* TAB 1: Financial & Balances */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Presupuesto Extras a Pagar</span>
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-3xl font-extrabold text-amber-400 mt-2 font-['Outfit']">
                  {totalExtraExpense.toFixed(2)} €
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Calculado a 10,00 € / hora trabajada</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Horas Extras Totales</span>
                  <Clock className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-['Outfit']">
                  {totalExtraHours.toFixed(1)} h
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Acumulado de jornadas registradas</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Personal en Nómina Fija</span>
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <p className="text-3xl font-extrabold text-indigo-400 mt-2 font-['Outfit']">
                  2 Personas
                </p>
                <p className="text-[11px] text-slate-500 mt-1">Irene + Raúl (Sin coste extra hora)</p>
              </div>
            </div>

            {/* Balances Table */}
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-sm flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span>Saldos Acumulados por Trabajador</span>
                </h4>
                <span className="text-[11px] text-slate-400">Actualización en tiempo real</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {balancesList.map((w, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-2xl">{w.avatar}</span>
                      {w.isPayroll ? (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Nómina Fija
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          10,00 € / h
                        </span>
                      )}
                    </div>

                    <div>
                      <h5 className="font-bold text-white text-base">{w.name}</h5>
                      <p className="text-[11px] text-slate-400 mt-0.5">{w.role}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">{w.totalHours.toFixed(1)}h completadas</span>
                      <span className="font-extrabold text-amber-400 font-mono text-sm">
                        {w.isPayroll ? '0,00 €' : `${w.totalCost.toFixed(2)} €`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Saldos & Acuerdos Detallados */}
        {activeTab === 'balances' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-base flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span>Control de Saldos & Acuerdos de Personal (Semana 3 & Acumulados)</span>
              </h4>
              <span className="text-xs text-slate-400">Actualizado al 14 Septiembre 2026</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {initialBalancesData.workers.map((worker) => {
                const isExpanded = expandedWorkerId === worker.id;

                return (
                  <div 
                    key={worker.id}
                    className={`bg-slate-950 border rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 ${
                      worker.statusType === 'danger'
                        ? 'border-rose-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-rose-950/20'
                        : worker.statusType === 'payroll'
                        ? 'border-indigo-500/30 bg-slate-950'
                        : 'border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl shrink-0">
                            {worker.avatar}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h5 className="font-bold text-white text-base font-['Outfit']">{worker.name}</h5>
                              {worker.statusType === 'success' && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  🟢 A favor
                                </span>
                              )}
                              {worker.statusType === 'danger' && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  🔴 Deuda Pendiente
                                </span>
                              )}
                              {worker.statusType === 'payroll' && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  ⭐ Nómina Fija
                                </span>
                              )}
                              {worker.statusType === 'neutral' && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                  ⚪ Sin Saldo
                                </span>
                              )}
                              {worker.hasTransportBonus && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center space-x-1">
                                  <Bus className="w-3 h-3" />
                                  <span>+10€ transport/día</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">{worker.role}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[9px] text-slate-500 block uppercase font-bold">
                            {worker.statusType === 'payroll' ? 'Coste Extra' : 'Saldo Actual'}
                          </span>
                          {worker.statusType === 'payroll' ? (
                            <span className="text-lg font-bold text-amber-400 font-mono">0,00 €</span>
                          ) : (
                            <span className={`text-xl sm:text-2xl font-extrabold font-mono ${
                              worker.currentBalance > 0 ? 'text-emerald-400' : worker.currentBalance < 0 ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                              {worker.currentBalance >= 0 ? `+${worker.currentBalance.toFixed(2)} €` : `${worker.currentBalance.toFixed(2)} €`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Special Jefferson Purse */}
                      {worker.isSpecialPurse && worker.purseInfo && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-amber-300">📦 Bolsa Mensual (80h)</span>
                            <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded">
                              {Math.round((worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100)}% Consumido
                            </span>
                          </div>

                          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-amber-500/20">
                            <div 
                              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                              style={{ width: `${(worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100}%` }}
                            ></div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Condición Base:</span>
                              <span className="font-semibold text-white">80h (700€ - 200€ Aloj.) = <b>500€ Neto</b></span>
                            </div>
                            <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Acumulado Septiembre:</span>
                              <span className="font-bold text-emerald-400">{worker.purseInfo.consumedHours}h ({worker.purseInfo.consumedValue.toFixed(2)}€)</span>
                            </div>
                          </div>

                          <button
                            onClick={() => setExpandedWorkerId(isExpanded ? null : worker.id)}
                            className="w-full py-1 text-center text-[11px] text-amber-400 font-semibold flex items-center justify-center space-x-1"
                          >
                            <span>{isExpanded ? 'Ocultar turnos bolsa' : 'Ver turnos consumidos (45.5h)'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <div className="pt-1.5 border-t border-amber-500/20 space-y-1 text-[10px] text-slate-300">
                              {worker.purseInfo.shifts.map((s, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-slate-900 p-1.5 rounded">
                                  <span>📅 {s.date} ({s.range})</span>
                                  <span className="font-bold text-amber-300">{s.hours}h</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Breakdown */}
                      <div className="mt-3 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Desglose:
                        </span>
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                          {worker.breakdown.map((item, idx) => (
                            <div key={idx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between">
                              <span className="text-slate-300">{item.concept}</span>
                              <span className={`font-bold font-mono ml-2 shrink-0 ${
                                item.amount > 0 ? 'text-emerald-400' : item.amount < 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}>
                                {item.amount > 0 ? `+${item.amount.toFixed(2)} €` : item.amount < 0 ? `${item.amount.toFixed(2)} €` : '0,00 €'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
                      <button
                        onClick={() => handleSendWhatsApp(worker)}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Redactar WhatsApp</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: Logistics Overview */}
        {activeTab === 'logistics' && (
          <div className="space-y-6">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="font-bold text-white text-base flex items-center space-x-2">
                <Truck className="w-5 h-5 text-amber-400" />
                <span>Estado de la Flota & Eventos ({activeWeekData?.meta?.week || "Semana 3"})</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                {(activeWeekData?.saturdaySpecial?.weddings || []).map((w, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
                    <span className="font-bold text-amber-300 block text-sm">🏔️ {w.location}</span>
                    <span className="text-slate-300 block font-medium">{w.truck}</span>
                    <p className="text-[11px] text-slate-400">{w.details}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
