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
  KeyRound
} from 'lucide-react';

import WeekManagerModal from './components/WeekManagerModal';
import GeminiAssistantModal from './components/GeminiAssistantModal';
import ClockInModal from './components/ClockInModal';
import PayrollReportModal from './components/PayrollReportModal';
import PartnerDashboardModal from './components/PartnerDashboardModal';
import PartnerDashboardView from './components/PartnerDashboardView';
import BalancesAgreementsModal from './components/BalancesAgreementsModal';
import WorkerView from './components/WorkerView';
import { logisticsData as BASE_DATA } from './data/logisticsData';

const WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión Covey (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión Gula (Propio)", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Jaime", role: "Conductor Flota (Guiado)", truck: "Camión Albacar (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión Covey / Apoyo", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Irene", role: "Base & Checklist", truck: "Almacén Base", avatar: "📦", isPayroll: true, rate: 14 },
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
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v8');
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
  const [isPartnerMode, setIsPartnerMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const hasSociasFlag = params.has('socias') || params.get('socias') !== null;
    const hasAdminFlag = params.has('admin') || params.get('admin') === 'true';
    const tokenParam = params.get('token') || params.get('key');
    const roleParam = params.get('role');
    const viewParam = params.get('view');
    const workerParam = params.get('worker');
    const isRaul = workerParam && (workerParam.toLowerCase() === 'raúl' || workerParam.toLowerCase() === 'raul');
    if (viewParam === 'public') return false;
    return (hasSociasFlag || hasAdminFlag || isRaul || !!tokenParam || roleParam === 'socias' || viewParam === 'socias' || roleParam === 'admin');
  });

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [isBalancesModalOpen, setIsBalancesModalOpen] = useState(false);

  const [copiedWorker, setCopiedWorker] = useState(null);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState(false);

  const SECURE_PARTNER_TOKEN = 'gula_socias_secure_98f7a2b9d31e40c5';

  // Detect URL params: ?week=week_3&worker=Raúl&admin=true
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    const workerParam = params.get('worker');
    const tokenParam = params.get('token') || params.get('key');
    const roleParam = params.get('role');
    const viewParam = params.get('view') || params.get('modal');
    const hasSociasFlag = params.has('socias') || params.get('socias') !== null;
    const hasAdminFlag = params.has('admin') || params.get('admin') === 'true';
    const isRaul = workerParam && (workerParam.toLowerCase() === 'raúl' || workerParam.toLowerCase() === 'raul');

    if (weekParam && allWeeks[weekParam]) {
      setActiveWeekId(weekParam);
    }
    if (workerParam) {
      const matched = WORKERS_LIST.find(w => w.name.toLowerCase() === workerParam.toLowerCase());
      if (matched) setActiveWorker(matched.name);
    }
    if (viewParam === 'saldos' || viewParam === 'acuerdos') {
      setIsBalancesModalOpen(true);
    }
    if (
      hasSociasFlag ||
      hasAdminFlag ||
      isRaul ||
      tokenParam === SECURE_PARTNER_TOKEN || 
      roleParam === 'socias' || 
      roleParam === 'admin' ||
      tokenParam === 'socias2026' || 
      tokenParam === 'gula2026'
    ) {
      setIsPartnerMode(true);
      setIsPartnerModalOpen(true);
    }
  }, []);

  const updateWeeks = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v8', JSON.stringify(newWeeks));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClockEntryCreated = (newEntry) => {
    const updated = [...clockEntries, newEntry];
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateClockEntry = (updatedEntry) => {
    const updated = clockEntries.map(e => e.id === updatedEntry.id ? updatedEntry : e);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteClockEntry = (entryId) => {
    const updated = clockEntries.filter(e => e.id !== entryId);
    setClockEntries(updated);
    try {
      localStorage.setItem('gula_clock_entries_v1', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearClockEntries = () => {
    setClockEntries([]);
    localStorage.removeItem('gula_clock_entries_v1');
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
    const isRaul = workerName.toLowerCase() === 'raúl' || workerName.toLowerCase() === 'raul';
    return `${window.location.origin}${window.location.pathname}?week=${activeWeekId}&worker=${encodeURIComponent(workerName)}${isRaul ? '&admin=true' : ''}`;
  };

  const getPartnerSecureLink = () => {
    return `${window.location.origin}${window.location.pathname}?token=${SECURE_PARTNER_TOKEN}`;
  };

  const copyWorkerLink = (workerName) => {
    navigator.clipboard.writeText(getWorkerLink(workerName));
    setCopiedWorker(workerName);
    setTimeout(() => setCopiedWorker(null), 3000);
  };

  const copyPartnerSecureLink = () => {
    navigator.clipboard.writeText(getPartnerSecureLink());
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
    const text = `🔒 Hola Socias, aquí tenéis el Enlace Seguro de Dirección para Gula Logística (Planificación + Saldos de Horas): ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Admin mode state (Raúl/dev is auto-admin; socias link is visual read-only by default)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get('worker');
    const isRaul = workerParam && (workerParam.toLowerCase() === 'raúl' || workerParam.toLowerCase() === 'raul');
    const hasAdminFlag = params.get('admin') === 'true' || params.has('admin');
    return isRaul || hasAdminFlag;
  });

  const params = new URLSearchParams(window.location.search);
  const workerParam = params.get('worker');
  const isRaul = workerParam && (workerParam.toLowerCase() === 'raúl' || workerParam.toLowerCase() === 'raul');
  const hasAdminFlag = params.get('admin') === 'true' || params.has('admin');
  const isAdmin = isRaul || hasAdminFlag || isAdminUnlocked;

  if (isPartnerMode) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950">
        <PartnerDashboardView 
          activeWeekData={activeWeek}
          allWeeks={allWeeks}
          activeWeekId={activeWeekId}
          onSelectWeek={setActiveWeekId}
          workersList={WORKERS_LIST}
          clockEntries={clockEntries}
          isAdmin={isAdmin}
          onUnlockAdmin={() => setIsAdminUnlocked(true)}
          onOpenClockIn={(workerName) => {
            if (workerName && typeof workerName === 'string') setActiveWorker(workerName);
            setIsClockInModalOpen(true);
          }}
          onOpenPayroll={() => setIsPayrollModalOpen(true)}
          onOpenGemini={() => setIsGeminiModalOpen(true)}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onOpenAddWeek={() => setIsWeekModalOpen(true)}
          onTogglePublicView={() => setIsPartnerMode(false)}
          onUpdateClockEntry={handleUpdateClockEntry}
          onDeleteClockEntry={handleDeleteClockEntry}
          onClockEntryCreated={handleClockEntryCreated}
        />

        <ClockInModal
          isOpen={isClockInModalOpen}
          onClose={() => setIsClockInModalOpen(false)}
          workersList={WORKERS_LIST}
          initialWorkerName={activeWorker}
          onClockEntryCreated={handleClockEntryCreated}
        />

        <PayrollReportModal
          isOpen={isPayrollModalOpen}
          onClose={() => setIsPayrollModalOpen(false)}
          entries={clockEntries}
          workersList={WORKERS_LIST}
          onClearEntries={handleClearClockEntries}
          isAdmin={isAdmin}
          onUpdateEntry={handleUpdateClockEntry}
          onDeleteEntry={handleDeleteClockEntry}
          onClockEntryCreated={handleClockEntryCreated}
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
        />

        <BalancesAgreementsModal
          isOpen={isBalancesModalOpen}
          onClose={() => setIsBalancesModalOpen(false)}
        />
      </div>
    );
  }

  if (activeWorker && !isPartnerMode) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-4 sm:p-6 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-950">
        <WorkerView
          workerName={activeWorker}
          workersList={WORKERS_LIST}
          activeWeekData={activeWeek}
          clockEntries={clockEntries}
          onToggleTask={(dayKey, taskIdx) => toggleTask(dayKey, taskIdx)}
          onClockEntryCreated={handleClockEntryCreated}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      <div className="w-full space-y-6">
        
        {/* Header Navigation Banner - Fluid Widescreen */}
        <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-5 sm:p-6 rounded-3xl shadow-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          
          {/* Title & Brand */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-start gap-4 w-full lg:w-auto">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Truck className="text-amber-400 w-6 h-6" />
                </div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-['Outfit']">
                  Panel de Control Gula Logística
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">{activeWeek.meta?.week} | {activeWeek.meta?.dateRange}</p>
              </div>
            </div>

            {/* Week Selector Dropdown & Badge */}
            <div className="flex items-center space-x-2.5">
              <select
                value={activeWeekId}
                onChange={(e) => setActiveWeekId(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-amber-400 font-bold px-3.5 py-2 rounded-xl text-xs focus:outline-none shadow-inner"
              >
                {Object.values(allWeeks).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.meta?.dateRange})</option>
                ))}
              </select>

              <button
                onClick={() => setIsWeekModalOpen(true)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition-all"
                title="Añadir Nueva Semana"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Semana</span>
              </button>

              <div className="hidden xl:flex bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-xs font-semibold items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{activeWeek.meta?.status || "Operativa Activa"}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar - Proportions & Spacing */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Clock In Button */}
            <button
              onClick={() => setIsClockInModalOpen(true)}
              className="flex-1 lg:flex-none bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Clock className="w-4 h-4" />
              <span>⏱️ Fichar</span>
            </button>

            {/* Partner Dashboard Button */}
            <button
              onClick={() => {
                setIsPartnerMode(true);
                setIsPartnerModalOpen(true);
              }}
              className="flex-1 lg:flex-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>👑 Panel Socias & Saldos</span>
            </button>

            {/* Saldos & Acuerdos Button */}
            <button
              onClick={() => setIsBalancesModalOpen(true)}
              className="flex-1 lg:flex-none bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-800 transition-all shadow-sm"
            >
              <span>📜 Saldos & Acuerdos</span>
            </button>

            {/* Payroll Report */}
            <button
              onClick={() => setIsPayrollModalOpen(true)}
              className="flex-1 lg:flex-none bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-800 transition-all"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Nóminas</span>
            </button>

            {/* Gemini AI */}
            <button
              onClick={() => setIsGeminiModalOpen(true)}
              className="flex-1 lg:flex-none bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-3.5 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Wand2 className="w-4 h-4" />
              <span>Gemini AI</span>
            </button>

            {/* Share Worker Links */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all active:scale-95"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>
        </header>

        {/* Worker Specific Banner if active */}
        {activeWorker && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 text-white p-5 rounded-3xl border border-blue-800/80 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="text-3xl p-2 bg-slate-950 rounded-2xl border border-slate-800">
                {WORKERS_LIST.find(w => w.name === activeWorker)?.avatar || "👤"}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Vista Personalizada</span>
                  {(activeWorker.toLowerCase() === 'raúl' || activeWorker.toLowerCase() === 'raul') && (
                    <span className="text-[10px] font-extrabold bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      👑 MODO DESARROLLADOR / ADMIN
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-extrabold font-['Outfit']">Planificación de {activeWorker} — {activeWeek.name}</h2>
                <div className="flex items-center space-x-2 text-xs text-slate-300 mt-1">
                  <span>{WORKERS_LIST.find(w => w.name === activeWorker)?.role}</span>
                  <span>•</span>
                  {WORKERS_LIST.find(w => w.name === activeWorker)?.isPayroll ? (
                    <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">Nómina Fija</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Extra (10 €/h)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
              {(activeWorker.toLowerCase() === 'raúl' || activeWorker.toLowerCase() === 'raul') && (
                <button
                  onClick={() => setIsPartnerMode(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-extrabold transition-colors shadow-md flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>👑 Panel Admin Completo</span>
                </button>
              )}

              <button
                onClick={() => setIsClockInModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-md"
              >
                ⏱️ Fichar Ahora
              </button>

              <button
                onClick={() => {
                  setActiveWorker(null);
                  window.history.pushState({}, '', window.location.pathname);
                }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl font-medium transition-colors border border-slate-700"
              >
                Ver Todo el Equipo
              </button>
            </div>
          </div>
        )}

        {/* Team Members Grid - Full Widescreen 9-Columns Layout */}
        <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="text-amber-400 w-4.5 h-4.5" /> Equipo, Nóminas y Extras ({WORKERS_LIST.length} Miembros)
            </h2>
            <span className="text-xs text-slate-400 hidden sm:inline">Haz clic en un trabajador para filtrar sus tareas</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-9 gap-3 text-xs">
            {WORKERS_LIST.map((w, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveWorker(w.name === activeWorker ? null : w.name)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                  activeWorker === w.name 
                    ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 text-white shadow-md' 
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
            ))}
          </div>
        </section>

        {/* Schedule Days Grid - 4 Columns Across Widescreen */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {Object.entries(activeWeek.schedule || {}).map(([key, day]) => (
            <div key={key} className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 shadow-xl backdrop-blur-xl flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                  <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
                    <Calendar className="text-amber-400 w-4.5 h-4.5" /> {day.title}
                  </h3>
                  <span className="text-[10px] bg-slate-950 text-amber-300 font-bold px-2.5 py-1 rounded-xl border border-slate-800">{day.badge}</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-300">
                  {(day.tasks || []).map((task, idx) => {
                    const taskText = typeof task === 'object' ? task.text : task;
                    const isCompleted = typeof task === 'object' ? task.completed : false;

                    return (
                      <li 
                        key={idx} 
                        onClick={() => toggleTask(key, idx)}
                        className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          isCompleted 
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through' 
                            : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <Clock className="text-amber-400 w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1 leading-relaxed">{taskText}</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Saturday Special Section */}
        {activeWeek.saturdaySpecial && (
          <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2 font-['Outfit'] text-white">
                <Fire className="text-amber-400 w-5.5 h-5.5" /> {activeWeek.saturdaySpecial.title}
              </h3>
              <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-3 py-1 rounded-xl border border-amber-500/30">Día Clave</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm">
              {(activeWeek.saturdaySpecial.weddings || []).map((w, idx) => (
                <div key={idx} className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 space-y-2">
                  <span className="font-extrabold text-amber-300 block text-sm sm:text-base font-['Outfit']">🏔️ {w.location}</span>
                  <span className="text-slate-200 block font-semibold">{w.truck}</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{w.details}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sunday / Monday Section */}
        {activeWeek.sundayMonday && (
          <section className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-xl space-y-3.5">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2 font-['Outfit']">
              <Broom className="text-amber-400 w-4.5 h-4.5" /> {activeWeek.sundayMonday.title}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs sm:text-sm text-slate-300">
              {(activeWeek.sundayMonday.tasks || []).map((task, idx) => {
                const taskText = typeof task === 'object' ? task.text : task;
                return (
                  <div key={idx} className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 leading-relaxed">
                    {taskText}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* Share Modal with Worker Links & Secure Partner Link */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white">
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
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Enlace Seguro para Socias (1 Clic - Sin clave)</span>
                </span>
                <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full">SEGURO</span>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={copyPartnerSecureLink}
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-colors border border-slate-700"
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
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp Socias</span>
                </button>
              </div>
            </div>

            {/* Workers List */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Enlaces de Trabajadores</span>
              {WORKERS_LIST.map((w, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{w.avatar}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-white text-sm">{w.name}</h4>
                        {w.isPayroll ? (
                          <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">Nómina</span>
                        ) : (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30">10€/h</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{w.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button
                      onClick={() => copyWorkerLink(w.name)}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
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
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20"
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

      {/* Modals */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        workersList={WORKERS_LIST}
        initialWorkerName={activeWorker}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <PayrollReportModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        entries={clockEntries}
        workersList={WORKERS_LIST}
        onClearEntries={handleClearClockEntries}
        isAdmin={isPartnerMode}
        onUpdateEntry={handleUpdateClockEntry}
        onDeleteEntry={handleDeleteClockEntry}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <PartnerDashboardModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        entries={clockEntries}
        workersList={WORKERS_LIST}
        activeWeekData={activeWeek}
        onClockEntryCreated={handleClockEntryCreated}
        onOpenClockModal={(workerName) => {
          if (workerName) setActiveWorker(workerName);
          setIsClockInModalOpen(true);
        }}
      />

      <BalancesAgreementsModal
        isOpen={isBalancesModalOpen}
        onClose={() => setIsBalancesModalOpen(false)}
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
      />
    </div>
  );
}
