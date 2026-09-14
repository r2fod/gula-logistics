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
  MessageCircle
} from 'lucide-react';

export default function PartnerDashboardModal({ 
  isOpen, 
  onClose, 
  entries = [], 
  workersList = [], 
  activeWeekData 
}) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState('financial'); // 'financial' | 'logistics' | 'workers'

  if (!isOpen) return null;

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
      const hourlyRate = isSalaried ? 0 : (rate || 10);
      const cost = diffHours * hourlyRate;

      workerBalances[workerName].totalHours += diffHours;
      workerBalances[workerName].totalCost += cost;
      workerBalances[workerName].completedShifts += 1;
    }
  });

  const balancesList = Object.values(workerBalances);
  const totalExtraExpense = balancesList.reduce((acc, curr) => acc + (curr.isSalaried ? 0 : curr.totalCost), 0);
  const totalExtraHours = balancesList.reduce((acc, curr) => acc + (curr.isSalaried ? 0 : curr.totalHours), 0);

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
        <div className="flex items-center space-x-2 mb-6 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'financial'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>💶 Saldos & Gastos de Extras</span>
          </button>

          <button
            onClick={() => setActiveTab('logistics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
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
