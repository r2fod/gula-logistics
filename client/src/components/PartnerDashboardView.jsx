import React, { useState } from 'react';
import { 
  ShieldCheck, 
  DollarSign, 
  Users, 
  Truck, 
  Calendar, 
  Copy, 
  Check, 
  Clock, 
  TrendingUp, 
  MessageCircle,
  Bus,
  ChevronDown,
  ChevronUp,
  Radio,
  Sparkles,
  Wand2,
  Share2,
  Plus,
  Activity,
  AlertTriangle,
  ListTodo,
  Eye,
  Lock,
  Edit3,
  Trash2
} from 'lucide-react';
import { initialBalancesData } from '../data/balancesData';
import LiveMonitorPanel from './LiveMonitorPanel';
import AdminClockEditModal from './AdminClockEditModal';

export default function PartnerDashboardView({ 
  activeWeekData, 
  allWeeks = {}, 
  activeWeekId, 
  onSelectWeek, 
  workersList = [], 
  clockEntries = [], 
  onOpenClockIn,
  onOpenPayroll,
  onOpenGemini,
  onOpenShareModal,
  onOpenAddWeek,
  onTogglePublicView,
  onUpdateClockEntry,
  onDeleteClockEntry,
  onClockEntryCreated
}) {
  const [activeTab, setActiveTab] = useState('balances'); // 'balances' | 'fichajes' | 'live' | 'financial' | 'logistics' | 'schedule'
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedWorkerId, setExpandedWorkerId] = useState('jefferson');

  // Admin Modal State
  const [editingEntry, setEditingEntry] = useState(null);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);

  const getPartnerSecureLink = () => {
    return `${window.location.origin}${window.location.pathname}?socias`;
  };

  const handleCopySecureLink = () => {
    navigator.clipboard.writeText(getPartnerSecureLink());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
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

  const handleOpenEditEntry = (entry) => {
    setEditingEntry(entry);
    setIsAdminEditOpen(true);
  };

  const handleOpenCreateEntry = () => {
    setEditingEntry(null);
    setIsAdminEditOpen(true);
  };

  // Process shift entries for financial calculations
  const workerBalances = {};
  workersList.forEach(w => {
    workerBalances[w.name] = {
      name: w.name,
      role: w.role,
      avatar: w.avatar,
      isPayroll: w.isPayroll,
      rate: w.rate || (w.isPayroll ? 14 : 10),
      totalHours: 0,
      totalCost: 0,
      completedShifts: 0
    };
  });

  const activeShifts = {};
  clockEntries.forEach(entry => {
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

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-4 sm:p-6 md:p-8 font-sans space-y-6">
      
      {/* Top Page Navigation Bar - Full Widescreen */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        
        {/* Title & Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-['Outfit']">
                  Panel Ejecutivo de Socias & Dirección
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-500 text-slate-950">
                  ADMIN AUTORIZADO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Gula Logística | {activeWeekData?.meta?.week || "Semana 3"} ({activeWeekData?.meta?.dateRange})
              </p>
            </div>
          </div>

          {/* Week selector */}
          <div className="flex items-center space-x-2">
            <select
              value={activeWeekId}
              onChange={(e) => onSelectWeek(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-amber-400 font-bold px-3 py-2 rounded-xl text-xs focus:outline-none"
            >
              {Object.values(allWeeks).map((w) => (
                <option key={w.id} value={w.id}>{w.name} ({w.meta?.dateRange})</option>
              ))}
            </select>

            <button
              onClick={onOpenAddWeek}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-800 transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>+ Semana</span>
            </button>
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end">
          <button
            onClick={onOpenClockIn}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            <Clock className="w-4 h-4" />
            <span>⏱️ Fichar Tarea</span>
          </button>

          <button
            onClick={onOpenPayroll}
            className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-800 transition-all"
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span>Nóminas & Informes</span>
          </button>

          <button
            onClick={onOpenGemini}
            className="bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
          >
            <Wand2 className="w-4 h-4" />
            <span>Gemini AI</span>
          </button>

          <button
            onClick={handleCopySecureLink}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-800 transition-all"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? '¡Link Copiado!' : 'Copiar Link Socias'}</span>
          </button>

          {onTogglePublicView && (
            <button
              onClick={() => onTogglePublicView(false)}
              className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 border border-amber-500/30 transition-all shadow-sm"
              title="Cambiar a la Vista Pública General"
            >
              <Eye className="w-4 h-4" />
              <span>👁️ Vista Pública</span>
            </button>
          )}
        </div>
      </header>

      {/* Primary View Navigation Tabs Bar */}
      <div className="flex items-center space-x-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('balances')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'balances'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>📜 Control de Saldos & Acuerdos</span>
        </button>

        <button
          onClick={() => setActiveTab('fichajes')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'fichajes'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4 text-amber-400" />
          <span>⚙️ Fichajes & Edición Admin ({clockEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('live')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'live'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4 animate-pulse text-rose-400" />
          <span>🔴 Actividad en Tiempo Real</span>
        </button>

        <button
          onClick={() => setActiveTab('financial')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'financial'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>💶 Resumen Financiero & Extras</span>
        </button>

        <button
          onClick={() => setActiveTab('logistics')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'logistics'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>🚚 Flota & Bodas</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>📋 Planificación de la Semana</span>
        </button>
      </div>

      {/* TAB 1: Saldos & Acuerdos Detallados */}
      {activeTab === 'balances' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-xl font-extrabold text-white font-['Outfit'] flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                <span>Control de Saldos & Acuerdos de Personal</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Desglose individual de turnos, bolsas de horas, roturas de vajilla y botones de WhatsApp.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-semibold bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              Actualizado: {initialBalancesData.lastUpdated}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {initialBalancesData.workers.map((worker) => {
              const isExpanded = expandedWorkerId === worker.id;

              return (
                <div 
                  key={worker.id}
                  className={`bg-slate-900 border rounded-3xl p-6 transition-all shadow-xl flex flex-col justify-between space-y-4 ${
                    worker.statusType === 'danger'
                      ? 'border-rose-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20'
                      : worker.statusType === 'payroll'
                      ? 'border-indigo-500/30 bg-slate-900'
                      : 'border-slate-800 hover:border-slate-700'
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
                            worker.currentBalance > 0 ? 'text-emerald-400' : worker.currentBalance < 0 ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {worker.currentBalance >= 0 ? `+${worker.currentBalance.toFixed(2)} €` : `${worker.currentBalance.toFixed(2)} €`}
                          </span>
                        )}
                      </div>
                    </div>

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
                            <span className="font-semibold text-white">80h (700€ - 200€ Aloj.) = <b>500€ Neto</b></span>
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
                          <span>{isExpanded ? 'Ocultar turnos bolsa' : 'Ver turnos consumidos (45.5h)'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="pt-2 border-t border-amber-500/20 space-y-1 text-xs text-slate-300">
                            {worker.purseInfo.shifts.map((s, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-950 p-2 rounded-lg">
                                <span>📅 <b>{s.date}</b> ({s.range})</span>
                                <span className="font-bold text-amber-300">{s.hours}h</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Breakdown */}
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
                                : 'bg-slate-950/80 border-slate-800 text-slate-200'
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
      )}

      {/* TAB 2: Control & Edición de Fichajes Admin */}
      {activeTab === 'fichajes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-xl font-extrabold text-white font-['Outfit']">
                  Gestión y Edición de Fichajes (Solo Admin)
                </h3>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-500 text-slate-950 rounded-full">
                  CONTROL ADMINISTRATIVO
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Una vez enviado por un trabajador, solo las socias pueden modificar hora, fecha, tipo o eliminar el fichaje.
              </p>
            </div>

            <button
              onClick={handleOpenCreateEntry}
              className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Añadir Fichaje Manual (Admin)</span>
            </button>
          </div>

          {clockEntries.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-slate-800">
              <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No hay fichajes registrados en el sistema.</p>
              <p className="text-xs text-slate-500 mt-1">Los fichajes realizados por los trabajadores aparecerán aquí automáticamente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Fecha & Hora</th>
                    <th className="py-3.5 px-4">Trabajador</th>
                    <th className="py-3.5 px-4">Tipo</th>
                    <th className="py-3.5 px-4">Tarea / Concepto</th>
                    <th className="py-3.5 px-4">Tarifa (€/h)</th>
                    <th className="py-3.5 px-4">Estado Seguridad</th>
                    <th className="py-3.5 px-4 text-center">Acciones Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {clockEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        <div className="font-bold text-white">{entry.timeFormatted}</div>
                        <div className="text-[10px] text-slate-500">{entry.dateFormatted}</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-white text-sm">
                        {entry.workerName}
                      </td>
                      <td className="py-3.5 px-4">
                        {entry.type === 'entrada' ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold inline-flex items-center space-x-1">
                            <span>🟢 ENTRADA</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold inline-flex items-center space-x-1">
                            <span>🔴 SALIDA</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {entry.taskName || entry.note || '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                        {entry.rate || 10} €/h
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 inline-flex items-center space-x-1">
                          <Lock className="w-3 h-3 text-amber-400" />
                          <span>🔒 Bloqueado a Trabajador</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => handleOpenEditEntry(entry)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>

                          <button
                            onClick={() => {
                              if (onDeleteClockEntry) onDeleteClockEntry(entry.id);
                            }}
                            className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all"
                            title="Eliminar Fichaje (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live Monitor Panel */}
      {activeTab === 'live' && (
        <div className="animate-fadeIn">
          <LiveMonitorPanel 
            workersList={workersList}
            clockEntries={clockEntries}
            activeSchedule={activeWeekData?.schedule || {}}
            isFullScreen={true}
            onClockEntryCreated={onOpenClockIn}
            onOpenClockModal={onOpenClockIn}
          />
        </div>
      )}

      {/* TAB 4: Financial Summary */}
      {activeTab === 'financial' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Presupuesto Extras a Pagar</span>
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-3xl font-extrabold text-amber-400 mt-2 font-['Outfit'] font-mono">
                {totalExtraExpense.toFixed(2)} €
              </p>
              <p className="text-xs text-slate-500 mt-1">Extras a 10,00 € / hora trabajada</p>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Valoración Control Nóminas</span>
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-3xl font-extrabold text-indigo-400 mt-2 font-['Outfit'] font-mono">
                {totalPayrollValuation.toFixed(2)} €
              </p>
              <p className="text-xs text-slate-500 mt-1">Irene + Raúl (Valoración interna a 14,00 €/h)</p>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-semibold uppercase">Horas Registradas</span>
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-3xl font-extrabold text-emerald-400 mt-2 font-['Outfit'] font-mono">
                {totalExtraHours.toFixed(1)} h
              </p>
              <p className="text-xs text-slate-500 mt-1">Acumulado de jornadas en fichaje</p>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <h4 className="font-bold text-white text-base flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>Resumen de Horas Fichadas por Trabajador</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {balancesList.map((w, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{w.avatar}</span>
                    {w.isPayroll ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        Nómina (14€/h)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Extra (10€/h)
                      </span>
                    )}
                  </div>

                  <div>
                    <h5 className="font-bold text-white text-base">{w.name}</h5>
                    <p className="text-xs text-slate-400 mt-0.5">{w.role}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">{w.totalHours.toFixed(1)}h fichadas</span>
                    <span className="font-extrabold text-amber-400 text-sm">
                      {w.totalCost.toFixed(2)} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Logistics & Weddings */}
      {activeTab === 'logistics' && (
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl space-y-4 animate-fadeIn">
          <h4 className="font-bold text-white text-lg flex items-center space-x-2 font-['Outfit']">
            <Truck className="w-6 h-6 text-amber-400" />
            <span>Estado de la Flota & Eventos Clave ({activeWeekData?.meta?.week || "Semana 3"})</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            {(activeWeekData?.saturdaySpecial?.weddings || []).map((w, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {w.location}</span>
                <span className="text-slate-200 block font-semibold">{w.truck}</span>
                <p className="text-xs text-slate-400 leading-relaxed">{w.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Schedule Days */}
      {activeTab === 'schedule' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
          {Object.entries(activeWeekData?.schedule || {}).map(([key, day]) => (
            <div key={key} className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
                  <Calendar className="text-amber-400 w-5 h-5" /> {day.title}
                </h4>
                <span className="text-xs bg-slate-950 text-amber-300 font-bold px-3 py-1 rounded-xl border border-slate-800">
                  {day.badge}
                </span>
              </div>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                {(day.tasks || []).map((task, idx) => {
                  const taskText = typeof task === 'object' ? task.text : task;
                  return (
                    <li key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 leading-relaxed">
                      {taskText}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Admin Clock Edit Modal */}
      <AdminClockEditModal
        isOpen={isAdminEditOpen}
        onClose={() => setIsAdminEditOpen(false)}
        entry={editingEntry}
        workersList={workersList}
        onUpdateEntry={onUpdateClockEntry}
        onDeleteEntry={onDeleteClockEntry}
        onClockEntryCreated={onClockEntryCreated}
      />

    </div>
  );
}
