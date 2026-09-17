import React, { useState, useEffect } from 'react';
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
  LayoutDashboard,
  Trash2,
  KeyRound,
  Zap,
  Menu,
  X,
  Save,
  Bell
} from 'lucide-react';
import { initialBalancesData } from '../data/balancesData';
import { fetchBalancesFromAPI, saveWorkerBalanceToAPI } from '../data/apiService';
import { sendPushNotification } from '../data/pushService';
import { pairShiftsFromEntries, aggregateShiftsByWorker } from '../data/shiftCalculations';
import LiveMonitorPanel from './LiveMonitorPanel';
import AdminClockEditModal from './AdminClockEditModal';
import TaskFlowGraphView from './TaskFlowGraphView';
import AdminSettingsModal from './AdminSettingsModal';

export default function PartnerDashboardView({ 
  activeWeekData, 
  allWeeks = {}, 
  activeWeekId, 
  onSelectWeek, 
  workersList = [], 
  clockEntries = [], 
  isAdmin = false,
  balancesData: externalBalancesData,
  setBalancesData: externalSetBalancesData,
  onUnlockAdmin,
  onLogoutAdmin,
  onOpenAdminLogin,
  onOpenClockIn,
  onOpenPayroll,
  onOpenGemini,
  onOpenShareModal,
  onOpenAddWeek,
  onTogglePublicView,
  onGoToDashboard,
  onUpdateClockEntry,
  onDeleteClockEntry,
  onClockEntryCreated,
  onAddWorker,
  onOpenWorkerEditor,
  onOpenTaskEditor,
  onToggleTask
}) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get('tab') || p.get('view');
      if (tab === 'balances' || tab === 'saldos' || tab === 'acuerdos') return 'balances';
      if (tab === 'financial' || tab === 'financiero' || tab === 'resumen') return 'financial';
      if (tab === 'schedule' || tab === 'planning' || tab === 'cuadrante') return 'schedule';
      if (tab === 'graph' || tab === 'grafo') return 'graph';
      if (tab === 'logistics' || tab === 'flota' || tab === 'bodas') return 'logistics';
      if (tab === 'fichajes' || tab === 'fichaje') return 'fichajes';
      if (tab === 'live' || tab === 'directo') return 'live';
      if (p.has('socias')) return 'balances';
    } catch (e) {}
    return 'live';
  });
  const [selectedWorkerFilter, setSelectedWorkerFilter] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedWorkerId, setExpandedWorkerId] = useState('jefferson');
  const [adminUnlocked, setAdminUnlocked] = useState(isAdmin);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [internalBalancesData, setInternalBalancesData] = useState(externalBalancesData || initialBalancesData);
  const balancesData = externalBalancesData || internalBalancesData;
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  const handleNotifyWorkers = async () => {
    if (!window.confirm("¿Seguro que quieres avisar a los trabajadores de que hay nuevos turnos?")) return;
    try {
      setIsPushLoading(true);
      await sendPushNotification(
        "¡Nuevos turnos asignados!", 
        "Revisa tu panel de trabajador, se han añadido o modificado tus turnos."
      );
      alert("Aviso enviado a los dispositivos de los trabajadores.");
    } catch (error) {
      alert("Hubo un error al enviar las notificaciones.");
    } finally {
      setIsPushLoading(false);
    }
  };

  const [addingConceptFor, setAddingConceptFor] = useState(null); // worker.id en edición, o null
  const [newConceptMode, setNewConceptMode] = useState('turno'); // 'turno' (fecha+horario, calcula solo) | 'manual' (concepto libre)
  const [newConceptText, setNewConceptText] = useState('');
  const [newConceptAmount, setNewConceptAmount] = useState('');
  const [newShiftDate, setNewShiftDate] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');
  const [savingBalanceId, setSavingBalanceId] = useState(null);

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabKey);
      if (url.searchParams.has('socias')) {
        url.searchParams.delete('socias');
      }
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  };

  useEffect(() => {
    setAdminUnlocked(isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    if (externalBalancesData) {
      setInternalBalancesData(externalBalancesData);
    }
  }, [externalBalancesData]);

  // Sync balances on load and tab change
  useEffect(() => {
    fetchBalancesFromAPI().then(apiData => {
      if (apiData && apiData.workers) {
        setInternalBalancesData(apiData);
        if (externalSetBalancesData) externalSetBalancesData(apiData);
      }
    });
  }, [activeTab]);

  // Actualiza un trabajador dentro de balancesData (en pantalla al instante)
  // y lo guarda en MongoDB vía PUT /api/balances/:id. Solo admin (los
  // botones que llaman a esto están ocultos si !adminUnlocked).
  const persistWorkerBalance = async (workerId, updatedFields) => {
    const currentWorkers = balancesData.workers || [];
    const newWorkers = currentWorkers.map(w => w.id === workerId ? { ...w, ...updatedFields } : w);
    const newBalancesData = { ...balancesData, workers: newWorkers };
    setInternalBalancesData(newBalancesData);
    if (externalSetBalancesData) externalSetBalancesData(newBalancesData);

    setSavingBalanceId(workerId);
    try {
      await saveWorkerBalanceToAPI(workerId, updatedFields);
    } finally {
      setSavingBalanceId(null);
    }
  };

  const parseHM = (hm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hm || '');
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  // Calcula horas + importe a partir de fecha/entrada/salida de un turno,
  // igual que se hace con los fichajes reales (pairShiftsFromEntries) —
  // aquí es manual porque es un turno que no se fichó desde el móvil.
  // Si el trabajador tiene bolsa mensual especial (Jefferson), las horas se
  // reparten primero a la tarifa de bolsa hasta agotar el cupo (80h) y el
  // resto se paga a la tarifa extra — igual que se explica en sus acuerdos.
  const computeShiftPreview = (worker) => {
    const startMin = parseHM(newShiftStart);
    const endMin = parseHM(newShiftEnd);
    if (startMin === null || endMin === null || !newShiftDate) return null;

    let diffMin = endMin - startMin;
    if (diffMin <= 0) diffMin += 24 * 60; // cruza medianoche (ej. bodas hasta la madrugada)
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

    if (!preview.isPurse) {
      const newItem = { concept: preview.concept, amount: preview.amount, isPositive: true };
      const newBreakdown = [...(worker.breakdown || []), newItem];
      const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);

      await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
      resetAddConceptForm();
      return;
    }

    // Trabajador con bolsa mensual (Jefferson): las horas dentro de cupo
    // actualizan la bolsa (consumedHours/consumedValue/shifts) y la línea
    // agregada "Valor Acumulado Horas Bolsa"; las horas que se pasan del
    // cupo se añaden como una línea normal a la tarifa extra.
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
  };

  const handleAddConcept = async (worker) => {
    const amount = parseFloat(newConceptAmount.replace(',', '.'));
    if (!newConceptText.trim() || Number.isNaN(amount)) return;

    const newItem = { concept: newConceptText.trim(), amount, isPositive: amount >= 0 };
    const newBreakdown = [...(worker.breakdown || []), newItem];
    const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);

    await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
    resetAddConceptForm();
  };

  const handleDeleteConcept = async (worker, idx) => {
    const newBreakdown = (worker.breakdown || []).filter((_, i) => i !== idx);
    const newBalance = newBreakdown.reduce((sum, it) => sum + it.amount, 0);
    await persistWorkerBalance(worker.id, { breakdown: newBreakdown, currentBalance: newBalance });
  };

  const handleRequestAdminUnlock = () => {
    if (onOpenAdminLogin) onOpenAdminLogin();
  };

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
  const { shifts: paidShifts } = pairShiftsFromEntries(clockEntries);
  const workerBalances = aggregateShiftsByWorker(paidShifts, workersList);
  const balancesList = Object.values(workerBalances);
  const totalExtraExpense = balancesList.reduce((acc, curr) => acc + (curr.isPayroll ? 0 : curr.totalCost), 0);
  const totalPayrollValuation = balancesList.reduce((acc, curr) => acc + (curr.isPayroll ? curr.totalCost : 0), 0);
  const totalExtraHours = balancesList.reduce((acc, curr) => acc + curr.totalHours, 0);

  // workerBalances viene indexado por el nombre "de pila" tal cual está en
  // workersList (ej. "Ricardo"), pero balancesData.workers usa "Nombre
  // Apellido" (ej. "Ricardo Gula") — coincidencia exacta nunca los cruza.
  // Busca por prefijo de palabra completa para tolerar ese sufijo.
  const findWorkerHours = (balanceWorkerName) => {
    if (!balanceWorkerName) return null;
    const normalized = balanceWorkerName.trim().toLowerCase().replace(/ff/g, 'f');
    const rosterKey = Object.keys(workerBalances).find(rosterName => {
      const rn = rosterName.toLowerCase().replace(/ff/g, 'f');
      return normalized === rn || normalized.startsWith(`${rn} `) || normalized.includes(rn);
    });
    return rosterKey ? workerBalances[rosterKey] : null;
  };

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-2.5 sm:p-4 md:p-5 font-sans space-y-3 w-full max-w-full overflow-x-hidden pb-32 lg:pb-16">
      
      {/* Top Page Navigation Bar - Compact & Responsive */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xl flex flex-col lg:flex-row lg:flex-wrap justify-between items-start lg:items-center gap-2.5 w-full max-w-full overflow-hidden">
        
        {/* Title & Selector (compact) */}
        <div className="flex items-center gap-2.5 min-w-0 max-w-full flex-wrap sm:flex-nowrap">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-amber-400">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="text-xs sm:text-base font-extrabold text-white tracking-tight font-['Outfit'] truncate">
                Panel de Control Gula Logística
              </h1>
              {adminUnlocked ? (
                <>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-amber-500 text-slate-950 flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    <span>👑 ADMIN</span>
                  </span>
                  <button onClick={() => setIsAdminSettingsOpen(true)} className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 flex items-center gap-1 transition-colors shrink-0">
                    <KeyRound className="w-2.5 h-2.5" />
                    <span>Clave</span>
                  </button>
                  <button 
                    onClick={() => { if (onLogoutAdmin) onLogoutAdmin(); setAdminUnlocked(false); }} 
                    className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 transition-colors shrink-0"
                  >
                    <span>Salir</span>
                  </button>
                </>
              ) : (
                <button onClick={handleRequestAdminUnlock} className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 flex items-center gap-1 transition-colors shrink-0">
                  <KeyRound className="w-2.5 h-2.5 text-blue-400" />
                  <span>Admin Login</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {activeWeekData?.meta?.week || "Semana 3"} · {activeWeekData?.meta?.dateRange}
            </p>
          </div>
        </div>

        {/* Center: Week selector */}
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <select
            value={activeWeekId}
            onChange={(e) => onSelectWeek(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-amber-400 font-bold px-3 py-1.5 rounded-xl text-xs focus:outline-none min-w-0 max-w-full flex-1 sm:flex-none sm:max-w-xs truncate"
          >
            {Object.values(allWeeks).map((w) => (
              <option key={w.id} value={w.id}>{w.name} ({w.meta?.dateRange})</option>
            ))}
          </select>
          {adminUnlocked && (
            <button onClick={onOpenAddWeek} className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border border-slate-800 transition-all shrink-0">
              <Plus className="w-3 h-3 text-amber-400" />
              <span>+ Semana</span>
            </button>
          )}
        </div>

        {/* Mobile Quick Action & Menu Bar (visible on mobile / tablet) */}
        <div className="flex lg:hidden items-center justify-between w-full pt-2 border-t border-slate-800/80 mt-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={onOpenClockIn} 
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>⏱️ Fichar</span>
            </button>

            {onOpenShareModal && (
              <button 
                onClick={onOpenShareModal} 
                className="bg-blue-600/20 active:bg-blue-600/40 text-blue-300 border border-blue-500/30 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            )}
          </div>

          <button 
            onClick={() => setIsMobileDrawerOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow-md active:scale-95 transition-all"
            aria-label="Abrir Menú"
          >
            <Menu className="w-4 h-4 text-amber-400" />
            <span>Menú</span>
          </button>
        </div>

        {/* Right: Desktop Action buttons toolbar (hidden on mobile, flex on desktop) */}
        <div className="hidden lg:flex lg:flex-wrap items-center justify-end gap-1.5 w-full lg:w-auto lg:flex-1">
          <button onClick={onOpenClockIn} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>⏱️ Fichar</span>
          </button>

          {adminUnlocked && (
            <button 
              onClick={handleNotifyWorkers} 
              disabled={isPushLoading}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-500/30 transition-all"
            >
              <Bell className={`w-3.5 h-3.5 shrink-0 ${isPushLoading ? 'animate-pulse' : 'animate-bounce'}`} />
              <span className="truncate">{isPushLoading ? 'Avisando...' : 'Avisar Cambios'}</span>
            </button>
          )}

          {adminUnlocked && onOpenTaskEditor && (
            <button onClick={onOpenTaskEditor} className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-orange-500/30 transition-all">
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">✏️ Planning</span>
            </button>
          )}

          {adminUnlocked && onOpenWorkerEditor && (
            <button onClick={onOpenWorkerEditor} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-500/30 transition-all">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">➕ Trabajador</span>
            </button>
          )}

          {adminUnlocked && (
            <button onClick={onOpenPayroll} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition-all">
              <DollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Nóminas</span>
            </button>
          )}

          {adminUnlocked && (
            <button onClick={onOpenGemini} className="bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all">
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>Gemini AI</span>
            </button>
          )}

          {onOpenShareModal && (
            <button onClick={onOpenShareModal} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95 transition-all" title="Enlaces de WhatsApp (Trabajadores y Socias)">
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </button>
          )}

          <button onClick={handleCopySecureLink} className="bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all" title="Copiar enlace directo al Panel de Socias">
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className="truncate">{copiedLink ? '¡Copiado!' : 'Link Socias'}</span>
          </button>

          {onTogglePublicView && (
            <button onClick={() => onTogglePublicView(false)} className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all" title="Vista Pública">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Vista Pública</span>
            </button>
          )}
        </div>
      </header>

      {/* Primary View Navigation Tabs Bar */}
      <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 sm:p-2 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar w-full max-w-full">
        <button
          onClick={() => handleTabClick('live')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'live'
              ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Radio className="w-3.5 h-3.5 animate-pulse text-rose-400" />
          <span>🔴 Actividad en Tiempo Real</span>
        </button>

        <button
          onClick={() => handleTabClick('schedule')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>📅 Cuadrante Semanal</span>
        </button>

        <button
          onClick={() => handleTabClick('graph')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'graph'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>🕸️ Grafo & Flujo</span>
        </button>

        <button
          onClick={() => handleTabClick('logistics')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'logistics'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>🚚 Flota & Bodas</span>
        </button>

        <button
          onClick={() => handleTabClick('balances')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'balances'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>📜 Saldos & Acuerdos</span>
        </button>

        <button
          onClick={() => handleTabClick('financial')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'financial'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>💶 Resumen Financiero</span>
        </button>

        <button
          onClick={() => handleTabClick('fichajes')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'fichajes'
              ? 'bg-amber-500 text-slate-950 font-extrabold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>⚙️ Historial Fichajes ({clockEntries.length})</span>
        </button>
      </div>

      {/* TAB 1: Saldos & Acuerdos Detallados */}
      {activeTab === 'balances' && (
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
              let consumedBolsa = 0;

              if (hours && hours.shifts && hours.shifts.length > 0) {
                hours.shifts.forEach(s => {
                  let computedCost = 0;
                  let computedConcept = '';
                  const fmtHours = (h) => (Number.isInteger(h) ? `${h}` : parseFloat(h.toFixed(2)).toString());

                  if (worker.isSpecialPurse && worker.purseInfo) {
                    const p = worker.purseInfo;
                    const remaining = Math.max(0, p.totalHours - consumedBolsa);
                    const purseHours = Math.min(s.durationHours, remaining);
                    const extraHours = Math.max(0, s.durationHours - purseHours);
                    computedCost = purseHours * p.hourlyRate + extraHours * p.extraRateAfter80h;
                    
                    if (extraHours === 0) {
                      computedConcept = `🕒 ${s.startDate} [${s.startTime} a ${s.endTime}] - ${fmtHours(s.durationHours)}h a ${p.hourlyRate}€/h (Bolsa)`;
                    } else if (purseHours === 0) {
                      computedConcept = `🕒 ${s.startDate} [${s.startTime} a ${s.endTime}] - ${fmtHours(s.durationHours)}h a ${p.extraRateAfter80h}€/h (Extra)`;
                    } else {
                      computedConcept = `🕒 ${s.startDate} [${s.startTime} a ${s.endTime}] - ${fmtHours(purseHours)}h a ${p.hourlyRate}€/h + ${fmtHours(extraHours)}h a ${p.extraRateAfter80h}€/h`;
                    }
                    consumedBolsa += s.durationHours;
                  } else {
                    computedCost = s.cost;
                    computedConcept = `🕒 ${s.startDate} [${s.startTime} a ${s.endTime}] - ${fmtHours(s.durationHours)}h a ${s.rate}€/h`;
                  }

                  dynamicCost += computedCost;
                  dynamicShifts.push({
                    concept: computedConcept,
                    amount: computedCost,
                    isDynamic: true
                  });
                });
              }
              
              const displayBalance = worker.currentBalance + dynamicCost;

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
                        {[...dynamicShifts, ...(worker.breakdown || [])].map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                              item.amount < 0
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-200'
                                : item.isDynamic
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100'
                                : 'bg-slate-950/80 border-slate-800 text-slate-200'
                            }`}
                          >
                            <span className="font-medium break-words min-w-0 flex-1 pr-2">{item.concept}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`font-bold font-mono ${
                                item.amount > 0 ? 'text-emerald-400' : item.amount < 0 ? 'text-rose-400' : 'text-slate-400'
                              }`}>
                                {item.amount > 0 ? `+${item.amount.toFixed(2)} €` : item.amount < 0 ? `${item.amount.toFixed(2)} €` : '0,00 €'}
                              </span>
                              {adminUnlocked && !item.isDynamic && (
                                <button
                                  onClick={() => handleDeleteConcept(worker, idx - dynamicShifts.length)}
                                  disabled={savingBalanceId === worker.id}
                                  className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-40"
                                  title="Eliminar concepto"
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
                            {/* Modo: turno (calcula solo) vs ajuste manual */}
                            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                              <button
                                onClick={() => setNewConceptMode('turno')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                  newConceptMode === 'turno' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                🕒 Turno (calcula solo)
                              </button>
                              <button
                                onClick={() => setNewConceptMode('manual')}
                                className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                                  newConceptMode === 'manual' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                ✏️ Ajuste manual
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
                            ) : (
                              <>
                                <input
                                  type="text"
                                  value={newConceptText}
                                  onChange={(e) => setNewConceptText(e.target.value)}
                                  placeholder="Concepto (ej: Roturas cristalería eventos)"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={newConceptAmount}
                                  onChange={(e) => setNewConceptAmount(e.target.value)}
                                  placeholder="Importe (usa - para restar, ej: -20.00)"
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-amber-500"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddConcept(worker)}
                                    disabled={savingBalanceId === worker.id}
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
      )}

      {/* TAB 2: Control & Consulta de Fichajes Registrados */}
      {activeTab === 'fichajes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-xl font-extrabold text-white font-['Outfit']">
                  Historial de Fichajes Registrados
                </h3>
                {adminUnlocked ? (
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-amber-500 text-slate-950 rounded-full">
                    CONTROL ADMINISTRATIVO
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                    <Eye className="w-3 h-3 text-blue-400" />
                    <span>MODO SOLO LECTURA (SOCIAS)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {adminUnlocked 
                  ? 'Como Administrador autorizado, puedes editar la fecha/hora o eliminar fichajes.' 
                  : 'Fichajes inmutables registrados por los trabajadores. Los datos están protegidos contra edición accidental.'}
              </p>
            </div>

            {adminUnlocked ? (
              <button
                onClick={handleOpenCreateEntry}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Añadir Fichaje Manual (Admin)</span>
              </button>
            ) : (
              <span className="text-xs text-slate-400 font-semibold bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Fichajes Inmutables (Protegidos)</span>
              </span>
            )}
          </div>

          {clockEntries.length === 0 ? (
            <div className="text-center py-12 bg-slate-950/60 rounded-2xl border border-slate-800">
              <Clock className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No hay fichajes registrados en el sistema.</p>
              <p className="text-xs text-slate-500 mt-1">Los fichajes realizados por los trabajadores aparecerán aquí automáticamente.</p>
            </div>
          ) : (() => {
            // Agrupado por trabajador (pedido por el usuario) — orden de
            // grupo según el roster (workersList), y dentro de cada grupo se
            // conserva el orden que ya trae clockEntries (más reciente primero).
            const byWorker = {};
            clockEntries.forEach(e => {
              if (!byWorker[e.workerName]) byWorker[e.workerName] = [];
              byWorker[e.workerName].push(e);
            });
            const orderedNames = [
              ...workersList.map(w => w.name).filter(n => byWorker[n]),
              ...Object.keys(byWorker).filter(n => !workersList.some(w => w.name === n))
            ];
            const groupedEntries = orderedNames.map(name => ({ name, entries: byWorker[name] }));

            return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-4">Fecha & Hora</th>
                    <th className="py-3.5 px-4">Tipo</th>
                    <th className="py-3.5 px-4">Tarea / Concepto</th>
                    <th className="py-3.5 px-4">Tarifa (€/h)</th>
                    <th className="py-3.5 px-4">Estado Seguridad</th>
                    {adminUnlocked && <th className="py-3.5 px-4 text-center">Acciones Admin</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {groupedEntries.map(({ name, entries }) => {
                    const profile = workersList.find(w => w.name === name);
                    return (
                      <React.Fragment key={name}>
                        <tr className="bg-slate-950/80">
                          <td colSpan={adminUnlocked ? 6 : 5} className="py-2 px-4">
                            <span className="inline-flex items-center gap-2 text-xs font-extrabold text-amber-300">
                              <span className="text-base">{profile?.avatar || '👤'}</span>
                              <span>{name}</span>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                {entries.length} {entries.length === 1 ? 'fichaje' : 'fichajes'}
                              </span>
                            </span>
                          </td>
                        </tr>
                        {entries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-950/50 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-200">
                        <div className="font-bold text-white">{entry.timeFormatted}</div>
                        <div className="text-[10px] text-slate-500">{entry.dateFormatted}</div>
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
                          <span>🔒 Registrado & Verificado</span>
                        </span>
                      </td>
                      {adminUnlocked && (
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
                      )}
                    </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
      )}

      {/* TAB 3: Live Monitor Panel */}
      {activeTab === 'live' && (
        <div className="animate-fadeIn">
          <LiveMonitorPanel
            workersList={workersList}
            clockEntries={clockEntries}
            activeSchedule={activeWeekData?.schedule || {}}
            onClockEntryCreated={onClockEntryCreated}
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
                {parseFloat(totalExtraHours.toFixed(2))} h
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
                    <span className="text-slate-400">{parseFloat(w.totalHours.toFixed(2))}h fichadas</span>
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
              <div key={`boda-${idx}`} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {w.location}</span>
                <span className="text-slate-200 block font-semibold">{w.truck}</span>
                <p className="text-xs text-slate-400 leading-relaxed">{w.details}</p>
              </div>
            ))}
            {(activeWeekData?.schedule?.jueves?.tasks || [])
              .filter((t) => ['j1', 'j2'].includes(t.id))
              .map((t) => (
                <div key={`jueves-${t.id}`} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-2">
                  <span className="font-extrabold text-amber-300 block text-base font-['Outfit']">🏔️ {t.location}</span>
                  <span className="text-slate-200 block font-semibold">{t.truck || 'Sin camión asignado'}</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{t.text}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 6: Schedule Days (Rich Cuadrante Semanal) */}
      {activeTab === 'schedule' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Team Members Grid - Full Widescreen Layout */}
          <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Users className="text-amber-400 w-4 h-4" /> Equipo, Nóminas y Extras ({workersList.length} Miembros)
              </h2>
              {selectedWorkerFilter ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20">
                    Filtrando: {selectedWorkerFilter}
                  </span>
                  <button
                    onClick={() => setSelectedWorkerFilter(null)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-xl border border-slate-700 transition-colors"
                  >
                    Ver Todo el Equipo
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Haz clic en un trabajador para filtrar sus tareas
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3 text-xs">
              {workersList.map((w, idx) => {
                const isSelected = selectedWorkerFilter === w.name;
                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedWorkerFilter(isSelected ? null : w.name)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                      isSelected 
                        ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/40 text-white shadow-lg shadow-amber-500/10' 
                        : 'bg-slate-950/80 border-slate-800/80 hover:border-amber-500/40 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl">{w.avatar}</div>
                      {w.isPayroll ? (
                        <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Nómina</span>
                      ) : (
                        <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">10€/h</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="font-extrabold text-white truncate text-xs block font-['Outfit']">{w.name}</span>
                      <span className="text-[10px] text-slate-400 block truncate mt-0.5">{w.role}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Schedule Days Grid - 4 Columns Across Widescreen */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {Object.entries(activeWeekData?.schedule || {}).map(([key, day]) => (
              <div key={key} className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                    <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
                      <Calendar className="text-amber-400 w-4 h-4" /> {day.title}
                    </h3>
                    <span className="text-[10px] bg-slate-950 text-amber-300 font-bold px-2.5 py-1 rounded-xl border border-slate-800">
                      {day.badge}
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-300">
                    {(day.tasks || []).map((task, idx) => {
                      const taskText = typeof task === 'object' ? task.text : task;
                      const isCompleted = typeof task === 'object' ? !!task.completed : false;
                      // Filtrar por el `assigned[]` real de la tarea, no por si
                      // el nombre aparece mencionado en el texto — el texto
                      // puede quedar desactualizado (p.ej. seguir diciendo
                      // "Apoyo: Jeferson" aunque ya no esté en assigned[]) y
                      // antes eso hacía que el filtro no coincidiera con lo
                      // que de verdad se editó en el editor de tareas.
                      const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
                      const matchesFilter = !selectedWorkerFilter || taskAssigned.some(name => name.toLowerCase() === selectedWorkerFilter.toLowerCase());

                      return (
                        <li 
                          key={idx} 
                          onClick={() => onToggleTask && onToggleTask(key, idx)}
                          className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                            isCompleted 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through' 
                              : matchesFilter && selectedWorkerFilter
                                ? 'bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/40 text-white font-medium shadow-sm'
                                : !matchesFilter && selectedWorkerFilter
                                  ? 'opacity-30 hover:opacity-80 bg-slate-950/60 border-slate-850 text-slate-400'
                                  : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-200'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              </div>
                            ) : (
                              <Clock className="text-amber-400 w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 leading-relaxed">
                            <span className={isCompleted ? 'line-through' : ''}>{taskText}</span>
                            {typeof task === 'object' && task.timeFrame && (
                              <span className="ml-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap">
                                <Clock className="w-3 h-3" />
                                {task.timeFrame}
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* Saturday Special Section */}
          {activeWeekData?.saturdaySpecial && (
            <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2 font-['Outfit'] text-white">
                  <Sparkles className="text-amber-400 w-5 h-5" /> {activeWeekData.saturdaySpecial.title}
                </h3>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-xl border border-amber-500/30">
                  Día Clave
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
                {(activeWeekData.saturdaySpecial.weddings || []).map((w, idx) => (
                  <div key={idx} className="bg-slate-950/90 p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-amber-500/30 transition-all">
                    <div className="flex items-start justify-between">
                      <span className="font-extrabold text-amber-300 block text-sm sm:text-base font-['Outfit']">🏔️ {w.location}</span>
                      {w.timeFrame && (
                        <span className="text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {w.timeFrame}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-200 block font-semibold">{w.truck}</span>
                    <p className="text-xs text-slate-400 leading-relaxed">{w.details}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sunday / Monday Section */}
          {activeWeekData?.sundayMonday && (
            <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-3.5">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
                <Calendar className="text-amber-400 w-4 h-4" /> {activeWeekData.sundayMonday.title}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs sm:text-sm text-slate-300">
                {(activeWeekData.sundayMonday.tasks || []).map((task, idx) => {
                  const taskText = typeof task === 'object' ? task.text : task;
                  return (
                    <div key={idx} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 leading-relaxed">
                      <span>{taskText}</span>
                      {typeof task === 'object' && task.timeFrame && (
                        <span className="ml-2 text-[10px] font-bold bg-slate-800/80 text-slate-300 px-2 py-0.5 rounded inline-flex items-center gap-1 align-middle whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          {task.timeFrame}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* TAB 7: Interactive Task Flow Graph */}
      {activeTab === 'graph' && (
        <TaskFlowGraphView activeWeekData={activeWeekData} workersList={workersList} />
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

      <AdminSettingsModal
        isOpen={isAdminSettingsOpen}
        onClose={() => setIsAdminSettingsOpen(false)}
      />

      {/* Mobile Slide-over Drawer Menu */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative w-full max-w-xs bg-slate-900 border-l border-slate-800 h-full p-5 flex flex-col justify-between shadow-2xl overflow-y-auto z-10">
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-white font-['Outfit']">Menú de Gestión</h3>
                    <p className="text-[10px] text-slate-400">Herramientas & Ajustes</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  aria-label="Cerrar Menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status / Role Card */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Modo de Acceso</span>
                  <span className="text-xs font-bold text-white flex items-center gap-1 mt-0.5">
                    {adminUnlocked ? '👑 Administrador' : '👥 Socias / Lectura'}
                  </span>
                </div>
                {adminUnlocked ? (
                  <button 
                    onClick={() => { if (onLogoutAdmin) onLogoutAdmin(); setAdminUnlocked(false); setIsMobileDrawerOpen(false); }}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  >
                    Salir
                  </button>
                ) : (
                  <button 
                    onClick={() => { handleRequestAdminUnlock(); setIsMobileDrawerOpen(false); }}
                    className="px-2.5 py-1 text-[10px] font-extrabold rounded-lg bg-amber-500 text-slate-950 shadow-md"
                  >
                    Desbloquear
                  </button>
                )}
              </div>

              {/* Drawer Sections: Operations & Tools */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Operaciones & Turnos
                  </h4>
                  <div className="space-y-1.5">
                    <button
                      onClick={() => { onOpenClockIn(); setIsMobileDrawerOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 shadow-md"
                    >
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>⏱️ Registrar Fichaje</span>
                    </button>

                    {adminUnlocked && onOpenTaskEditor && (
                      <button
                        onClick={() => { onOpenTaskEditor(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-orange-400 border border-slate-800"
                      >
                        <Edit3 className="w-4 h-4 shrink-0" />
                        <span>✏️ Editor de Planning Semanal</span>
                      </button>
                    )}

                    {adminUnlocked && onOpenWorkerEditor && (
                      <button
                        onClick={() => { onOpenWorkerEditor(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800"
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        <span>➕ Gestión de Trabajadores</span>
                      </button>
                    )}

                    {adminUnlocked && (
                      <button
                        onClick={() => { onOpenPayroll(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800"
                      >
                        <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>💵 Nóminas y Horas Extra</span>
                      </button>
                    )}

                    {adminUnlocked && (
                      <button
                        onClick={() => { onOpenGemini(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-amber-500/20 to-indigo-500/20 hover:from-amber-500/30 text-amber-300 border border-amber-500/30"
                      >
                        <Wand2 className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>✨ Asistente IA Gemini</span>
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                    Compartir & Accesos
                  </h4>
                  <div className="space-y-1.5">
                    {onOpenShareModal && (
                      <button
                        onClick={() => { onOpenShareModal(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30"
                      >
                        <Share2 className="w-4 h-4 text-blue-400 shrink-0" />
                        <span>💬 Compartir por WhatsApp</span>
                      </button>
                    )}

                    <button
                      onClick={() => { handleCopySecureLink(); setIsMobileDrawerOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800"
                    >
                      {copiedLink ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <Copy className="w-4 h-4 text-amber-400 shrink-0" />}
                      <span>{copiedLink ? '¡Enlace Copiado!' : '📋 Copiar Link de Socias'}</span>
                    </button>

                    {onTogglePublicView && (
                      <button
                        onClick={() => { onTogglePublicView(false); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                      >
                        <Eye className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>👁️ Vista Pública de Operativa</span>
                      </button>
                    )}
                  </div>
                </div>

                {adminUnlocked && (
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                      Configuración
                    </h4>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => { setIsAdminSettingsOpen(true); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                      >
                        <KeyRound className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>⚙️ Claves & Configuración</span>
                      </button>
                      <button
                        onClick={() => { onOpenAddWeek(); setIsMobileDrawerOpen(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                      >
                        <Plus className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>📅 Añadir Nueva Semana</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 block">Gula Logística · v2.5 Mobile</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Navigation Bar (Thumb-Accessible) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl safe-bottom">
        <button
          onClick={() => handleTabClick('live')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all relative ${
            activeTab === 'live'
              ? 'text-emerald-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-5 h-5 mb-0.5 text-rose-400 animate-pulse" />
          <span className="text-[10px]">En Vivo</span>
        </button>

        <button
          onClick={() => handleTabClick('schedule')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'schedule'
              ? 'text-amber-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Cuadrante</span>
        </button>

        <button
          onClick={() => handleTabClick('balances')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'balances'
              ? 'text-amber-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Saldos</span>
        </button>

        <button
          onClick={() => handleTabClick('graph')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
            activeTab === 'graph'
              ? 'text-amber-400 font-extrabold scale-105'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Grafo</span>
        </button>

        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-slate-400 hover:text-amber-400 transition-all"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span className="text-[10px]">Menú</span>
        </button>
      </nav>
    </div>
  );
}
