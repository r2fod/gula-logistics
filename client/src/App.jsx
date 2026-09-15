import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Users, 
  Calendar, 
  Clock, 
  Flame as Fire, 
  Broom, 
  Share2, 
  Check, 
  Copy, 
  Send, 
  X, 
  CheckCircle2, 
  UserCheck, 
  Sparkles,
  MessageCircle,
  Plus,
  Wand2,
  DollarSign,
  Play,
  Square,
  FileText,
  ShieldCheck,
  Lock,
  Eye,
  KeyRound,
  Edit3
} from 'lucide-react';

import WeekManagerModal from './components/WeekManagerModal';
import GeminiAssistantModal from './components/GeminiAssistantModal';
import ClockInModal from './components/ClockInModal';
import PayrollReportModal from './components/PayrollReportModal';
import PartnerDashboardView from './components/PartnerDashboardView';
import BalancesAgreementsModal from './components/BalancesAgreementsModal';
import AdminWorkerEditorModal from './components/AdminWorkerEditorModal';
import AdminTaskEditorModal from './components/AdminTaskEditorModal';

import WorkerView from './components/WorkerView';
import PublicView from './components/PublicView';
import AdminLoginModal from './components/AdminLoginModal';
import { logisticsData as BASE_DATA } from './data/logisticsData';
import {
  fetchClockEntriesFromAPI,
  saveClockEntryToAPI,
  updateClockEntryInAPI,
  deleteClockEntryInAPI,
  clearAllClockEntriesInAPI,
  getStoredAdminToken,
  setStoredAdminToken,
  logoutAdmin,
  fetchWeeksFromAPI,
  saveWeeksToAPI
} from './data/apiService';
import { initialBalancesData } from './data/balancesData';

const DEFAULT_WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión Covey (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión Gula (Propio)", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Jaime", role: "Conductor Flota (Guiado)", truck: "Camión Albacar (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión Covey / Apoyo", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Irene", role: "Ayudante Logística / Prepara Eventos / Verifica Checklist", truck: "Almacén Base", avatar: "📦", isPayroll: true, rate: 14 },
  { name: "Jeferson", role: "Apoyo Logística & Prep", truck: "Base / Camión Gula", avatar: "📦", isPayroll: false, rate: 10 },
  { name: "Kerly", role: "Gula Limpieza Eventos", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Jose", role: "Gula Limpieza & Apoyo", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Raúl", role: "Jefe de Logística", truck: "Supervisión Flota", avatar: "📋", isPayroll: true, rate: 14 }
];

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  ...BASE_DATA
};

export default function App() {
  const [workersList, setWorkersList] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_workers_v1');
      return saved ? JSON.parse(saved) : DEFAULT_WORKERS_LIST;
    } catch {
      return DEFAULT_WORKERS_LIST;
    }
  });

  const [balancesData, setBalancesData] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_balances_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.workers) && parsed.workers.some(w => (w.breakdown && w.breakdown.length > 0) || (w.currentBalance && w.currentBalance !== 0))) {
          return parsed;
        }
      }
      return initialBalancesData;
    } catch {
      return initialBalancesData;
    }
  });

  const handleAddWorker = (newWorker) => {
    // 1. Añadir a la lista de trabajadores
    const updatedWorkers = [...workersList, newWorker];
    setWorkersList(updatedWorkers);
    localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers));

    // 2. Añadir perfil de saldo automático
    const newBalanceProfile = {
      id: newWorker.name.toLowerCase().replace(/\s+/g, '-'),
      name: newWorker.name,
      role: newWorker.role,
      avatar: newWorker.avatar || "👤",
      status: "Sin saldo",
      statusType: "neutral",
      currentBalance: 0.00,
      agreements: [
        "Extra a 10,00 € / hora (Por Defecto)"
      ],
      breakdown: [
        { concept: "Alta inicial en el sistema", amount: 0.00, isPositive: true }
      ],
      notes: "Añadido manualmente al sistema."
    };

    const updatedBalances = {
      ...balancesData,
      workers: [...(balancesData.workers || []), newBalanceProfile]
    };
    setBalancesData(updatedBalances);
    localStorage.setItem('gula_balances_v1', JSON.stringify(updatedBalances));
  };

  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v10');
      return saved ? JSON.parse(saved) : { week_3: BASE_WEEK_3 };
    } catch {
      return { week_3: BASE_WEEK_3 };
    }
  });

  const [clockEntries, setClockEntries] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_clock_entries_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeWeekId, setActiveWeekId] = useState('week_3');
  const [activeWorker, setActiveWorker] = useState(null);
  const [showFullTeamView, setShowFullTeamView] = useState(false);
  const [isPublicPreviewMode, setIsPublicPreviewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'public';
  });
  const [isPartnerMode, setIsPartnerMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');

    // ❗ CRITICAL: Si hay ?worker= en la URL, SIEMPRE modo trabajador (ignora localStorage)
    const workerParam = params.get('worker');
    if (workerParam) return false;

    if (viewParam === 'public') return false;

    const hasSociasFlag = params.has('socias') || params.get('socias') !== null;
    const hasAdminFlag = params.has('admin') || params.get('admin') === 'true';
    const tokenParam = params.get('token') || params.get('key');
    const roleParam = params.get('role');

    // A real admin session token (not a fakeable flag) also defaults back to partner view.
    const savedAdminMode = !!getStoredAdminToken();

    return (hasSociasFlag || hasAdminFlag || !!tokenParam || roleParam === 'socias' || viewParam === 'socias' || roleParam === 'admin' || savedAdminMode);
  });

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isBalancesModalOpen, setIsBalancesModalOpen] = useState(false);
  const [isWorkerEditorModalOpen, setIsWorkerEditorModalOpen] = useState(false);
  const [isTaskEditorModalOpen, setIsTaskEditorModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  const [copiedWorker, setCopiedWorker] = useState(null);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState(false);

  const clearUrlParams = () => {
    try {
      const url = new URL(window.location.href);
      url.search = '';
      window.history.pushState({}, '', url.pathname);
    } catch {
      // safe fallback
    }
  };

  // Detect URL params & sync sensitive clock entries from MongoDB / API
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    const workerParam = params.get('worker');
    const tokenParam = params.get('token') || params.get('key');
    const roleParam = params.get('role');
    const viewParam = params.get('view') || params.get('modal');
    const hasSociasFlag = params.has('socias') || params.get('socias') !== null;
    const hasAdminFlag = params.has('admin') || params.get('admin') === 'true';

    if (weekParam && allWeeks[weekParam]) {
      setActiveWeekId(weekParam);
    }
    if (workerParam) {
      const matched = workersList.find(w => w.name.toLowerCase() === workerParam.toLowerCase());
      if (matched) setActiveWorker(matched.name);
    }
    if (viewParam === 'saldos' || viewParam === 'acuerdos') {
      setIsBalancesModalOpen(true);
    }

    // A real, server-issued admin session token travelling in the link
    // (shared by an admin via "Copiar Link Socias") unlocks the same access
    // as logging in directly — no password baked into the URL or the bundle.
    if (tokenParam) {
      setStoredAdminToken(tokenParam, Date.now() + 30 * 24 * 60 * 60 * 1000);
      setIsAdminUnlocked(true);
    }
    if (hasSociasFlag || hasAdminFlag || roleParam === 'socias' || roleParam === 'admin' || !!tokenParam) {
      setIsPartnerMode(true);
    }

    // Sync sensitive clock entries from backend MongoDB Atlas
    fetchClockEntriesFromAPI().then(remoteEntries => {
      if (remoteEntries && Array.isArray(remoteEntries) && remoteEntries.length > 0) {
        setClockEntries(remoteEntries);
      }
    });

    // Sync the shared weekly planning from MongoDB Atlas — this is the
    // source of truth now, not each browser's own localStorage copy.
    fetchWeeksFromAPI().then(remoteWeeks => {
      if (remoteWeeks) {
        setAllWeeks(remoteWeeks);
        try {
          localStorage.setItem('gula_logistics_all_weeks_v10', JSON.stringify(remoteWeeks));
        } catch (e) {
          console.error(e);
        }
      }
    });
  }, []);

  // Poll for fresh clock entries so the Live Monitor reflects fichajes made
  // from other workers' own links (their phones) without a manual refresh.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchClockEntriesFromAPI().then(remoteEntries => {
        if (remoteEntries && Array.isArray(remoteEntries)) {
          setClockEntries(remoteEntries);
        }
      });
      fetchWeeksFromAPI().then(remoteWeeks => {
        if (remoteWeeks) setAllWeeks(remoteWeeks);
      });
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const updateWeeks = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v10', JSON.stringify(newWeeks));
    } catch (e) {
      console.error(e);
    }
    saveWeeksToAPI(newWeeks);
  };

  const handleUpdateActiveWeek = (updatedWeekData) => {
    const newWeeks = { ...allWeeks, [activeWeekId]: updatedWeekData };
    updateWeeks(newWeeks);
  };

  const handleClockEntryCreated = (newEntry) => {
    const updated = [...clockEntries, newEntry];
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    saveClockEntryToAPI(newEntry);
  };

  const handleUpdateClockEntry = (updatedEntry) => {
    const updated = clockEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    updateClockEntryInAPI(updatedEntry);
  };

  const handleDeleteClockEntry = (entryId) => {
    const updated = clockEntries.filter(e => e.id !== entryId);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    deleteClockEntryInAPI(entryId);
  };

  const handleClearClockEntries = () => {
    setClockEntries([]);
    localStorage.removeItem('gula_clock_entries_v1');
    clearAllClockEntriesInAPI();
  };

  const activeWeek = allWeeks[activeWeekId] || BASE_WEEK_3;

  // Toggle tasks
  const toggleTask = (dayKey, taskIdx) => {
    const currentSchedule = { ...activeWeek.schedule };
    if (currentSchedule[dayKey] && currentSchedule[dayKey].tasks) {
      const taskItem = currentSchedule[dayKey].tasks[taskIdx];
      if (typeof taskItem === 'object') {
        taskItem.completed = !taskItem.completed;
      } else {
        currentSchedule[dayKey].tasks[taskIdx] = {
          text: taskItem,
          completed: true
        };
      }
      updateWeeks({ ...allWeeks, [activeWeekId]: { ...activeWeek, schedule: currentSchedule } });
    }
  };

  // Create new week
  const handleCreateWeek = ({ name, dateRange, cloneCurrent }) => {
    const newId = `week_${Date.now()}`;
    const template = cloneCurrent ? JSON.parse(JSON.stringify(activeWeek)) : JSON.parse(JSON.stringify(BASE_WEEK_3));
    
    const newWeekObj = {
      ...template,
      id: newId,
      name,
      meta: {
        ...template.meta,
        week: name,
        dateRange,
        status: "Operativa Activa"
      }
    };

    updateWeeks({ ...allWeeks, [newId]: newWeekObj });
    setActiveWeekId(newId);
  };

  // Apply Gemini AI Schedule
  const handleApplyGeminiSchedule = (aiGeneratedJson) => {
    const updatedWeek = {
      ...activeWeek,
      meta: { ...activeWeek.meta, ...aiGeneratedJson.meta },
      schedule: aiGeneratedJson.schedule || activeWeek.schedule,
      saturdaySpecial: aiGeneratedJson.saturdaySpecial || activeWeek.saturdaySpecial,
      sundayMonday: aiGeneratedJson.sundayMonday || activeWeek.sundayMonday
    };
    updateWeeks({ ...allWeeks, [activeWeekId]: updatedWeek });
  };

  // Link Generators
  const getWorkerLink = (workerName) => {
    return `${window.location.origin}${window.location.pathname}?week=${activeWeekId}&worker=${encodeURIComponent(workerName)}`;
  };

  // Enlace para Socias: si hay token de admin lo incluye, y si no, genera el enlace directo ?socias
  const getPartnerSecureLink = () => {
    const token = getStoredAdminToken();
    if (token) {
      return `${window.location.origin}${window.location.pathname}?socias&token=${token}`;
    }
    return `${window.location.origin}${window.location.pathname}?socias`;
  };

  const copyWorkerLink = (workerName) => {
    navigator.clipboard.writeText(getWorkerLink(workerName));
    setCopiedWorker(workerName);
    setTimeout(() => setCopiedWorker(null), 3000);
  };

  const copyPartnerSecureLink = () => {
    const link = getPartnerSecureLink();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedPartnerLink(true);
    setTimeout(() => setCopiedPartnerLink(false), 3000);
  };

  const shareViaWhatsApp = (workerName) => {
    const link = getWorkerLink(workerName);
    const text = `🚚 Hola ${workerName}, aquí tienes tu planificación y fichaje para ${activeWeek.name} de Gula Logística: ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const sharePartnerLinkWhatsApp = () => {
    const link = getPartnerSecureLink();
    if (!link) return;
    const text = `🔒 Hola Socias, aquí tenéis el Enlace Seguro de Dirección para Gula Logística (Planificación + Saldos de Horas): ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Admin mode state — the source of truth is the signed backend session
  // token (getStoredAdminToken), never a plain localStorage flag a visitor
  // could fake from devtools with localStorage.setItem('x', 'true').
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => !!getStoredAdminToken());
  const isAdmin = isAdminUnlocked;

  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdminUnlocked(false);
  };

  const params = new URLSearchParams(window.location.search);
  const workerParam = params.get('worker');

  if (activeWorker) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-950">
        <WorkerView
          workerName={activeWorker}
          workersList={workersList}
          activeWeekData={activeWeek}
          clockEntries={clockEntries}
          onToggleTask={(dayKey, taskIdx) => toggleTask(dayKey, taskIdx)}
          onClockEntryCreated={handleClockEntryCreated}
          onUpdateClockEntry={handleUpdateClockEntry}
          onDeleteClockEntry={handleDeleteClockEntry}
          onOpenAdminDashboard={() => {
            setActiveWorker(null);
            clearUrlParams();
            setIsAdminLoginOpen(true);
          }}
        />
      </div>
    );
  }

  // Genuinely public, no-sensitive-data view: no saldos, no nóminas, no admin
  // controls, regardless of whether this browser also has an admin session.
  if (isPublicPreviewMode && !activeWorker) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans">
        <div className="w-full space-y-4">
          <button
            onClick={() => { setIsPublicPreviewMode(false); clearUrlParams(); }}
            className="text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 px-3.5 py-2 rounded-xl font-semibold transition-colors border border-slate-800 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Volver al Panel</span>
          </button>
          <PublicView
            data={activeWeek}
            workersList={workersList}
            clockEntries={clockEntries}
            onToggleTask={() => {}}
            onClockEntryCreated={handleClockEntryCreated}
            onOpenClockModal={(workerName) => {
              if (workerName) setActiveWorker(workerName);
              setIsClockInModalOpen(true);
            }}
          />
        </div>

        <ClockInModal
          isOpen={isClockInModalOpen}
          onClose={() => setIsClockInModalOpen(false)}
          workersList={workersList}
          initialWorkerName={activeWorker}
          onClockEntryCreated={handleClockEntryCreated}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
      <PartnerDashboardView 
        activeWeekData={activeWeek}
        allWeeks={allWeeks}
        activeWeekId={activeWeekId}
        onSelectWeek={setActiveWeekId}
        workersList={workersList}
        clockEntries={clockEntries}
        isAdmin={isAdmin}
        balancesData={balancesData}
        setBalancesData={setBalancesData}
        onAddWorker={handleAddWorker}
        onOpenWorkerEditor={() => setIsWorkerEditorModalOpen(true)}
        onOpenTaskEditor={() => setIsTaskEditorModalOpen(true)}
        onLogoutAdmin={handleAdminLogout}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onOpenClockIn={(workerName) => {
          if (workerName && typeof workerName === 'string') setActiveWorker(workerName);
          setIsClockInModalOpen(true);
        }}
        onOpenPayroll={() => setIsPayrollModalOpen(true)}
        onOpenGemini={() => setIsGeminiModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenAddWeek={() => setIsWeekModalOpen(true)}
        onTogglePublicView={() => setIsPublicPreviewMode(true)}
        onToggleTask={(dayKey, taskIdx) => toggleTask(dayKey, taskIdx)}
        onUpdateClockEntry={handleUpdateClockEntry}
        onDeleteClockEntry={handleDeleteClockEntry}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        workersList={workersList}
        initialWorkerName={activeWorker}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <PayrollReportModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        entries={clockEntries}
        workersList={workersList}
        onClearEntries={handleClearClockEntries}
        isAdmin={isAdmin}
        onUpdateEntry={handleUpdateClockEntry}
        onDeleteEntry={handleDeleteClockEntry}
        onClockEntryCreated={handleClockEntryCreated}
        activeWeekData={activeWeek}
      />

      <WeekManagerModal
        isOpen={isWeekModalOpen}
        onClose={() => setIsWeekModalOpen(false)}
        onCreateWeek={handleCreateWeek}
        currentWeekName={activeWeek.name}
      />

      <GeminiAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        onApplyGeneratedSchedule={handleApplyGeminiSchedule}
        activeWeekData={activeWeek}
      />

      {/* Share Modal with Worker Links & Secure Partner Link */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-2xl text-white max-h-[92vh] overflow-y-auto overflow-x-hidden">
            <button 
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Share2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold font-['Outfit']">Enlaces de WhatsApp</h3>
                <p className="text-xs text-slate-400">Envía a cada trabajador o socia su enlace seguro</p>
              </div>
            </div>

            {/* Partner Link Box */}
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Enlace para Socias (1 Clic - Sin clave)</span>
                </span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">SOCIAS</span>
              </div>

              <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={getPartnerSecureLink()}
                  className="bg-transparent text-xs text-amber-300/90 font-mono w-full min-w-0 focus:outline-none select-all truncate"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={copyPartnerSecureLink}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors border border-slate-700 whitespace-nowrap"
                >
                  {copiedPartnerLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Link Socias</span>
                    </>
                  )}
                </button>

                <button
                  onClick={sharePartnerLinkWhatsApp}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20 whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Socias</span>
                </button>
              </div>
            </div>

            {/* Workers List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto overflow-x-hidden pr-1">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Enlaces de Trabajadores</span>
              {workersList.map((w, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 overflow-hidden">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <span className="text-2xl shrink-0">{w.avatar}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-white text-sm truncate">{w.name}</h4>
                        {w.isPayroll ? (
                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">Nómina</span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">10€/h</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate" title={w.role}>{w.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() => copyWorkerLink(w.name)}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      {copiedWorker === w.name ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">¡Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Link</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => shareViaWhatsApp(w.name)}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20 whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <BalancesAgreementsModal
        isOpen={isBalancesModalOpen}
        onClose={() => setIsBalancesModalOpen(false)}
        balancesData={balancesData}
        setBalancesData={(newData) => {
          setBalancesData(newData);
          localStorage.setItem('gula_balances_v1', JSON.stringify(newData));
        }}
      />

      <AdminWorkerEditorModal 
        isOpen={isWorkerEditorModalOpen}
        onClose={() => setIsWorkerEditorModalOpen(false)}
        onAddWorker={handleAddWorker}
      />

      <AdminTaskEditorModal
        isOpen={isTaskEditorModalOpen}
        onClose={() => setIsTaskEditorModalOpen(false)}
        activeWeekData={activeWeek}
        workersList={workersList}
        onSaveWeekData={handleUpdateActiveWeek}
      />

      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onSuccess={() => {
          setIsAdminUnlocked(true);
        }}
      />
    </div>
  );
}
