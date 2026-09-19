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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { initialBalancesData } from '../data/balancesData';
import { fetchBalancesFromAPI, saveWorkerBalanceToAPI } from '../data/apiService';
import { sendPushNotification } from '../data/pushService';
import { pairShiftsFromEntries, aggregateShiftsByWorker } from '../data/shiftCalculations';
import TeamBalancesTab from './dashboard/TeamBalancesTab';
import FinancialSummaryTab from './dashboard/FinancialSummaryTab';
import LogisticsTab from './dashboard/LogisticsTab';
import ScheduleTab from './dashboard/ScheduleTab';
import FichajesTab from './dashboard/FichajesTab';
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
  const [adminUnlocked, setAdminUnlocked] = useState(isAdmin);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [internalBalancesData, setInternalBalancesData] = useState(externalBalancesData || initialBalancesData);
  const balancesData = externalBalancesData || internalBalancesData;
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState(false);
  const [selectedWorkersToNotify, setSelectedWorkersToNotify] = useState([]);

  const handleOpenNotifyModal = () => {
    setSelectedWorkersToNotify([]);
    setIsNotifyModalOpen(true);
  };

  const handleSendNotification = async () => {
    try {
      setIsPushLoading(true);
      await sendPushNotification(
        "¡Nuevos turnos asignados!", 
        "Revisa tu panel de trabajador, se han añadido o modificado tus turnos.",
        selectedWorkersToNotify
      );
      alert(`Aviso enviado correctamente a ${selectedWorkersToNotify.length === 0 ? 'todos' : selectedWorkersToNotify.length + ' trabajador(es)'}.`);
      setIsNotifyModalOpen(false);
    } catch (error) {
      alert("Hubo un error al enviar las notificaciones.");
    } finally {
      setIsPushLoading(false);
    }
  };


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

  const rawBalancesData = externalBalancesData || internalBalancesData || { workers: [] };
  const mergedBalancesData = { ...rawBalancesData };
  mergedBalancesData.workers = workersList.map(worker => {
    const existing = (rawBalancesData.workers || []).find(w => w.name.toLowerCase() === worker.name.toLowerCase());
    if (existing) return existing;
    return {
      id: worker.name.toLowerCase().replace(/\s+/g, '-'),
      name: worker.name,
      role: worker.role,
      avatar: worker.avatar || "👤",
      status: "Sin saldo",
      statusType: "neutral",
      currentBalance: 0.00,
      agreements: [worker.isPayroll ? "Nómina Fija (Control interno)" : "Extra a 10,00 € / hora (Por Defecto)"],
      breakdown: []
    };
  });

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

  // Group shifts by Event (taskName) using V2 subTasks
  const summaryByEvent = paidShifts.reduce((acc, shift) => {
    // Para cada shift, iteramos por sus subTasks (las fracciones de jornada V2, o la tarea única V1)
    const subTasks = shift.subTasks || [];
    
    subTasks.forEach(subTask => {
      let eventName = subTask.eventName || 'Sin Asignar / Extra';
      
      // Grouping key (case-insensitive)
      const groupKey = eventName.toLowerCase();

      if (!acc[groupKey]) {
        acc[groupKey] = {
          eventName: eventName, // Preserve original casing
          totalCost: 0,
          totalHours: 0,
          workers: {}
        };
      }

      // Cost and hours are already calculated precisely for this subTask in pairShiftsFromEntries
      const shiftCost = subTask.cost || 0;
      const hours = subTask.durationHours || 0;

      acc[groupKey].totalCost += shiftCost;
      acc[groupKey].totalHours += hours;

      const workerName = shift.workerName || 'Desconocido';
      if (!acc[groupKey].workers[workerName]) {
        // Encontrar su avatar
        const workerRoster = workersList.find(w => w.name?.toLowerCase().includes(workerName.toLowerCase() || ''));
        const avatar = workerRoster?.avatar || '👤';
        
        acc[groupKey].workers[workerName] = {
          name: workerName,
          avatar,
          cost: 0,
          hours: 0,
        };
      }
      acc[groupKey].workers[workerName].cost += shiftCost;
      acc[groupKey].workers[workerName].hours += hours;
    });

    return acc;
  }, {});

  // Convert to array and sort by total cost descending
  const eventsList = Object.values(summaryByEvent).sort((a, b) => b.totalCost - a.totalCost);

  // Generate Master Table Rows (Operativa Logística)
  const masterTableRows = [];
  if (activeTab === 'schedule' && activeWeekData?.schedule) {
    Object.entries(activeWeekData.schedule).forEach(([dayKey, dayData]) => {
      const dateString = dayData.title || dayKey; 

      (dayData.tasks || []).forEach(task => {
        const taskText = typeof task === 'object' ? task.text : task;
        const taskAssigned = typeof task === 'object' && Array.isArray(task.assigned) ? task.assigned : [];
        
        let eventName = taskText || 'Sin Asignar';
        let specificTaskName = 'Tarea General';
        if (eventName.includes(' - ')) {
          const parts = eventName.split(' - ');
          eventName = parts[0].trim();
          specificTaskName = parts.slice(1).join(' - ').trim();
        }

        taskAssigned.forEach(workerName => {
          let matchSubTask = null;
          let matchShift = null;

          paidShifts.forEach(shift => {
            if (shift.workerName === workerName && shift.subTasks) {
              const st = shift.subTasks.find(s => s.taskName === taskText);
              if (st) {
                matchSubTask = st;
                matchShift = shift;
              }
            }
          });

          const profile = workersList.find(w => w.name === workerName) || { isPayroll: false, role: 'Extra' };

          masterTableRows.push({
            date: dateString,
            eventName,
            specificTaskName,
            workerName,
            isPayroll: profile.isPayroll,
            role: profile.role,
            startTime: matchShift ? matchShift.startTime : '—',
            endTime: matchShift ? matchShift.endTime : '—',
            hours: matchSubTask ? matchSubTask.durationHours : null,
            cost: matchSubTask ? matchSubTask.cost : null,
            status: matchSubTask ? 'Completado' : 'Pendiente'
          });
        });
      });
    });
  }

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
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xl flex flex-col gap-3 w-full max-w-full overflow-hidden">
        
        {/* Top Row: Title & Week Selector */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full">
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
                <span className="whitespace-nowrap">+ Semana</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Quick Action & Menu Bar (visible on mobile / tablet) */}
        <div className="flex lg:hidden items-center justify-between w-full pt-2 border-t border-slate-800/80 mt-1">
          <div className="flex items-center gap-2">
            <button 
              onClick={onOpenClockIn} 
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 active:from-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">⏱️ Fichar</span>
            </button>

            {onOpenShareModal && (
              <button 
                onClick={onOpenShareModal} 
                className="bg-blue-600/20 active:bg-blue-600/40 text-blue-300 border border-blue-500/30 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all shrink-0"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="whitespace-nowrap">WhatsApp</span>
              </button>
            )}
          </div>

          <button 
            onClick={() => setIsMobileDrawerOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow-md active:scale-95 transition-all shrink-0"
            aria-label="Abrir Menú"
          >
            <Menu className="w-4 h-4 text-amber-400" />
            <span className="whitespace-nowrap">Menú</span>
          </button>
        </div>

        {/* Right: Desktop Action buttons toolbar (hidden on mobile, flex on desktop) */}
        <div className="hidden lg:flex items-center justify-center gap-1.5 w-full overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80">
          <button onClick={onOpenClockIn} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all shrink-0">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">⏱️ Fichar</span>
          </button>

          {adminUnlocked && (
            <button 
              onClick={handleOpenNotifyModal} 
              disabled={isPushLoading}
              className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-500/30 transition-all shrink-0"
            >
              <Bell className={`w-3.5 h-3.5 shrink-0 ${isPushLoading ? 'animate-pulse' : 'animate-bounce'}`} />
              <span className="whitespace-nowrap truncate max-w-[120px]">{isPushLoading ? 'Avisando...' : 'Avisar Cambios'}</span>
            </button>
          )}

          {adminUnlocked && onOpenTaskEditor && (
            <button onClick={onOpenTaskEditor} className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-400 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-orange-500/30 transition-all shrink-0">
              <Edit3 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[100px]">✏️ Planning</span>
            </button>
          )}

          {adminUnlocked && onOpenWorkerEditor && (
            <button onClick={onOpenWorkerEditor} className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-500/30 transition-all shrink-0">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[100px]">➕ Trabajador</span>
            </button>
          )}

          {adminUnlocked && (
            <button onClick={onOpenPayroll} className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-800 transition-all shrink-0">
              <DollarSign className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="whitespace-nowrap">Nóminas</span>
            </button>
          )}

          {adminUnlocked && (
            <button onClick={onOpenGemini} className="bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all shrink-0">
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">Gemini AI</span>
            </button>
          )}

          {onOpenShareModal && (
            <button onClick={onOpenShareModal} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 active:scale-95 transition-all shrink-0" title="Enlaces de WhatsApp (Trabajadores y Socias)">
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[100px]">WhatsApp</span>
            </button>
          )}

          <button onClick={handleCopySecureLink} className="bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all shrink-0" title="Copiar enlace directo al Panel de Socias">
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
            <span className="whitespace-nowrap truncate max-w-[100px]">{copiedLink ? '¡Copiado!' : 'Link Socias'}</span>
          </button>

          {onTogglePublicView && (
            <button onClick={() => onTogglePublicView(false)} className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all shrink-0" title="Vista Pública">
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap truncate max-w-[100px]">Vista Pública</span>
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
        <TeamBalancesTab
          balancesData={mergedBalancesData}
          onOpenShareModal={onOpenShareModal}
          adminUnlocked={adminUnlocked}
          onDeleteClockEntry={onDeleteClockEntry}
          persistWorkerBalance={persistWorkerBalance}
          onSendWhatsApp={handleSendWhatsApp}
          findWorkerHours={findWorkerHours}
        />
      )}

      {/* TAB 2: Control & Consulta de Fichajes Registrados */}
      {activeTab === 'fichajes' && (
        <FichajesTab
          clockEntries={clockEntries}
          adminUnlocked={adminUnlocked}
          workersList={workersList}
          handleOpenCreateEntry={handleOpenCreateEntry}
          handleOpenEditEntry={handleOpenEditEntry}
          onDeleteClockEntry={onDeleteClockEntry}
        />
      )}

      {/* TAB 3: Live Monitor Panel */}
      {activeTab === 'live' && (
        <div className="animate-fadeIn">
          <LiveMonitorPanel
            workersList={workersList}
            clockEntries={clockEntries}
            activeWeekData={activeWeekData}
            onClockEntryCreated={onClockEntryCreated}
            onOpenClockModal={onOpenClockIn}
          />
        </div>
      )}

      {/* TAB 4: Financial Summary */}
      {activeTab === 'financial' && (
        <FinancialSummaryTab
          totalExtraExpense={totalExtraExpense}
          totalPayrollValuation={totalPayrollValuation}
          totalExtraHours={totalExtraHours}
          eventsList={eventsList}
          balancesList={balancesList}
        />
      )}

      {/* TAB 5: Logistics & Weddings */}
      {activeTab === 'logistics' && (
        <LogisticsTab activeWeekData={activeWeekData} />
      )}

      {/* TAB 6: Schedule Days (Rich Cuadrante Semanal) */}
      {activeTab === 'schedule' && (
        <ScheduleTab
          activeWeekData={activeWeekData}
          workersList={workersList}
          onToggleTask={onToggleTask}
        />
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

                    {adminUnlocked && (
                      <button
                        onClick={() => { handleOpenNotifyModal(); setIsMobileDrawerOpen(false); }}
                        disabled={isPushLoading}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      >
                        <Bell className={`w-4 h-4 shrink-0 ${isPushLoading ? 'animate-pulse' : ''}`} />
                        <span>{isPushLoading ? 'Avisando...' : '🔔 Avisar Cambios'}</span>
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
      {/* Modales y Drawers (existentes arriba, pero este es el de Avisar Cambios) */}
      {isNotifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-400" />
                ¿A quién quieres avisar?
              </h2>
              <button onClick={() => setIsNotifyModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
              <p className="text-xs text-slate-400 mb-3">
                Selecciona a los trabajadores que recibirán la notificación de cambios en su planning. Si no seleccionas a ninguno, se enviará a <strong>todos</strong>.
              </p>
              
              <button 
                onClick={() => setSelectedWorkersToNotify([])}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedWorkersToNotify.length === 0 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'}`}
              >
                <span>Avisar a Todos</span>
                {selectedWorkersToNotify.length === 0 && <Check className="w-4 h-4" />}
              </button>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {workersList.map(w => {
                  const isSelected = selectedWorkersToNotify.includes(w.name);
                  return (
                    <button
                      key={w.name}
                      onClick={() => {
                        setSelectedWorkersToNotify(prev => 
                          prev.includes(w.name) ? prev.filter(n => n !== w.name) : [...prev, w.name]
                        );
                      }}
                      className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border text-[11px] font-bold transition-all ${isSelected ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10' : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                    >
                      <span>{w.avatar}</span>
                      <span className="truncate">{w.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
              <button 
                onClick={() => setIsNotifyModalOpen(false)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSendNotification}
                disabled={isPushLoading}
                className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-colors"
              >
                <Bell className={`w-3.5 h-3.5 ${isPushLoading ? 'animate-pulse' : ''}`} />
                {isPushLoading ? 'Enviando...' : 'Enviar Aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
