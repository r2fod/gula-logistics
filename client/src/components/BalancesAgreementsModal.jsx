import React, { useState, useEffect } from 'react';
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
  AlertTriangle,
  Search,
  ChevronDown,
  ChevronUp,
  Bus,
  Home,
  CheckCircle2
} from 'lucide-react';
import { initialBalancesData } from '../data/balancesData';
import { fetchBalancesFromAPI } from '../data/apiService';

export default function BalancesAgreementsModal({ isOpen, onClose, balancesData, setBalancesData, isAdmin }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'favor' | 'debt' | 'payroll'
  const [copiedId, setCopiedId] = useState(null);
  const [expandedWorkerId, setExpandedWorkerId] = useState('jefferson'); // Default expand Jefferson to show purse details

  useEffect(() => {
    if (isOpen && setBalancesData) {
      fetchBalancesFromAPI().then(apiData => {
        if (apiData && apiData.workers) {
          setBalancesData(apiData);
        }
      });
    }
  }, [isOpen, setBalancesData]);

  if (!isOpen) return null;

  const workers = balancesData?.workers || initialBalancesData.workers;

  // Filter workers based on search and tab
  const filteredWorkers = workers.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          w.role.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (filterType === 'favor') return w.currentBalance > 0 && !w.statusType.includes('payroll');
    if (filterType === 'debt') return w.currentBalance < 0;
    if (filterType === 'payroll') return w.statusType === 'payroll';

    return true;
  });

  // Calculate totals
  const totalPositive = workers.reduce((acc, w) => acc + (w.currentBalance > 0 ? w.currentBalance : 0), 0);
  const totalDebt = workers.reduce((acc, w) => acc + (w.currentBalance < 0 ? Math.abs(w.currentBalance) : 0), 0);
  const extrasCount = workers.filter(w => !w.statusType.includes('payroll')).length;
  const payrollCount = workers.filter(w => w.statusType === 'payroll').length;

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

  const handleCopySummary = (worker) => {
    let summaryText = `${worker.name} (${worker.role}) - Saldo: ${worker.currentBalance.toFixed(2)}€`;
    navigator.clipboard.writeText(summaryText);
    setCopiedId(worker.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-white max-h-[92vh] overflow-y-auto flex flex-col justify-between">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header Banner */}
        <div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl sm:text-2xl font-extrabold font-['Outfit'] text-white">
                    Control de Saldos & Acuerdos
                  </h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    ACTUALIZADO {balancesData.lastUpdated || '—'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Visión completa de cuentas, bolsas de horas, roturas de cristalería y saldos a favor o en deuda.
                </p>
              </div>
            </div>

            {/* Quick Filter Search */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar por nombre o rol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all"
              />
            </div>
          </div>

          {/* Metrics Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Total a Favor (Extras)</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1 font-['Outfit']">
                +{totalPositive.toFixed(2)} €
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Pendiente de abonar a personal</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Deuda Pendiente (Anticipos)</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 mt-1 font-['Outfit']">
                -{totalDebt.toFixed(2)} €
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Compensación mediante turnos</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Bolsa Jefferson (80h)</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 mt-1 font-['Outfit']">
                45.5 h / 80 h
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">34.5h pendientes para extra a 10€/h</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-400">Equipo en Ficha</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1 font-['Outfit']">
                {workers.length} Personas
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">{extrasCount} Extras | {payrollCount} Nóminas Fijas</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-3 overflow-x-auto">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Todos ({workers.length})
            </button>

            <button
              onClick={() => setFilterType('favor')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === 'favor'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🟢 A Favor
            </button>

            <button
              onClick={() => setFilterType('debt')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === 'debt'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🔴 Con Deuda Pendiente
            </button>

            <button
              onClick={() => setFilterType('payroll')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                filterType === 'payroll'
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ⭐ Nómina Fija
            </button>
          </div>

          {/* Workers Detailed Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredWorkers.map((worker) => {
              const isExpanded = expandedWorkerId === worker.id;

              return (
                <div 
                  key={worker.id}
                  className={`bg-slate-950 border rounded-3xl p-5 sm:p-6 transition-all shadow-lg flex flex-col justify-between space-y-4 ${
                    worker.statusType === 'danger'
                      ? 'border-rose-500/40 bg-gradient-to-br from-slate-950 via-slate-950 to-rose-950/20'
                      : worker.statusType === 'payroll'
                      ? 'border-indigo-500/30 bg-slate-950'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Worker Info Bar */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                          {worker.avatar}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-extrabold text-white text-lg font-['Outfit']">{worker.name}</h4>
                            
                            {/* Badges */}
                            {worker.statusType === 'success' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                🟢 A favor
                              </span>
                            )}
                            {worker.statusType === 'danger' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                🔴 Deuda Pendiente
                              </span>
                            )}
                            {worker.statusType === 'payroll' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                ⭐ Nómina Fija
                              </span>
                            )}
                            {worker.statusType === 'neutral' && (
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
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

                      {/* Main Balance Display */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                          {worker.statusType === 'payroll' ? 'Coste Extra' : 'Saldo Actual'}
                        </span>
                        {worker.statusType === 'payroll' ? (
                          <span className="text-xl font-extrabold text-amber-400 font-mono">0,00 €</span>
                        ) : (
                          <span className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                            worker.currentBalance > 0 ? 'text-emerald-400' : worker.currentBalance < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {worker.currentBalance >= 0 ? `+${worker.currentBalance.toFixed(2)} €` : `${worker.currentBalance.toFixed(2)} €`}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Special Purse Box for Jefferson */}
                    {worker.isSpecialPurse && worker.purseInfo && (
                      <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-extrabold text-amber-300 flex items-center space-x-1.5">
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>Acuerdo Bolsa Mensual (80h)</span>
                          </span>
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded">
                            {Math.round((worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100)}% Consumido
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-amber-500/20">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                            style={{ width: `${(worker.purseInfo.consumedHours / worker.purseInfo.totalHours) * 100}%` }}
                          ></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 block">Condición Base:</span>
                            <span className="font-semibold text-white">80h a 8,75€/h = 700€</span>
                            <span className="text-[11px] text-rose-300 block">-200€ Alojamiento = <b>500€ Neto</b></span>
                          </div>
                          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                            <span className="text-[11px] text-slate-400 block">Consumido Septiembre:</span>
                            <span className="font-bold text-emerald-400">{worker.purseInfo.consumedHours}h ({worker.purseInfo.consumedValue.toFixed(2)}€)</span>
                            <span className="text-[11px] text-amber-300 block">Quedan {worker.purseInfo.remainingHoursForExtra}h para pasar a 10€/h</span>
                          </div>
                        </div>

                        {/* Shifts dropdown toggle */}
                        <button
                          onClick={() => setExpandedWorkerId(isExpanded ? null : worker.id)}
                          className="w-full py-1.5 text-center text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center justify-center space-x-1"
                        >
                          <span>{isExpanded ? 'Ocultar turnos consumidos' : 'Ver detalle de turnos consumidos (45.5h)'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="pt-2 border-t border-amber-500/20 space-y-1.5 text-[11px] text-slate-300">
                            {worker.purseInfo.shifts.map((s, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-2 rounded-lg">
                                <span>📅 <b>{s.date}</b> ({s.range})</span>
                                <span className="font-bold text-amber-300">{s.hours}h</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Breakdown List */}
                    <div className="mt-4 space-y-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Desglose de Conceptos & Turnos
                      </span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {worker.breakdown.map((item, idx) => (
                          <div 
                            key={idx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                              item.amount < 0
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                                : 'bg-slate-900/80 border-slate-800 text-slate-200'
                            }`}
                          >
                            <span className="font-medium">{item.concept}</span>
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

                  {/* Actions Toolbar */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleCopySummary(worker)}
                      className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 border border-slate-800 transition-colors"
                    >
                      {copiedId === worker.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSendWhatsApp(worker)}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
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

      </div>
    </div>
  );
}
