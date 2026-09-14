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
  FileText
} from 'lucide-react';

import WeekManagerModal from './components/WeekManagerModal';
import GeminiAssistantModal from './components/GeminiAssistantModal';
import ClockInModal from './components/ClockInModal';
import PayrollReportModal from './components/PayrollReportModal';
import { logisticsData as BASE_DATA } from './data/logisticsData';

const WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión 1 / Albacar", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión 1 (Gran Vol.)", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Jaime", role: "Conductor Flota (Guiado)", truck: "Camión 3 (Albacar)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión 2 / Apoyo", avatar: "🚚", isPayroll: false, rate: 10 },
  { name: "Irene", role: "Base & Checklist", truck: "Almacén Base", avatar: "📦", isPayroll: true, rate: 0 },
  { name: "Jeferson", role: "Apoyo Logística & Prep", truck: "Base / Camión 1", avatar: "📦", isPayroll: false, rate: 10 },
  { name: "Kerly", role: "Gula Limpieza Eventos", truck: "Limpieza Almacén", avatar: "🧹", isPayroll: false, rate: 10 },
  { name: "Raúl", role: "Jefe de Logística", truck: "Supervisión Flota", avatar: "📋", isPayroll: true, rate: 0 }
];

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  ...BASE_DATA
};

export default function App() {
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v6');
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

  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  
  const [copiedWorker, setCopiedWorker] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  // Detect params ?week=week_3&worker=Gonzalo
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    const workerParam = params.get('worker');
    if (weekParam && allWeeks[weekParam]) {
      setActiveWeekId(weekParam);
    }
    if (workerParam) {
      const matched = WORKERS_LIST.find(w => w.name.toLowerCase() === workerParam.toLowerCase());
      if (matched) setActiveWorker(matched.name);
    }
  }, []);

  const updateWeeks = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v6', JSON.stringify(newWeeks));
      setLastSyncTime(new Date().toLocaleTimeString());
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
    return `${window.location.origin}${window.location.pathname}?week=${activeWeekId}&worker=${encodeURIComponent(workerName)}`;
  };

  const copyWorkerLink = (workerName) => {
    navigator.clipboard.writeText(getWorkerLink(workerName));
    setCopiedWorker(workerName);
    setTimeout(() => setCopiedWorker(null), 3000);
  };

  const shareViaWhatsApp = (workerName) => {
    const link = getWorkerLink(workerName);
    const text = `🚚 Hola ${workerName}, aquí tienes tu planificación y fichaje para ${activeWeek.name} de Gula Logística: ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 antialiased p-4 md:p-8 selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Navigation Banner */}
        <header className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-xl md:text-2xl font-extrabold flex items-center gap-2.5">
                <Truck className="text-blue-400 w-6 h-6" /> Panel de Control Gula Logística
              </h1>
            </div>

            {/* Multi-Week Selector */}
            <div className="flex items-center space-x-2 mt-2">
              <select
                value={activeWeekId}
                onChange={(e) => setActiveWeekId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-amber-400 font-bold px-3 py-1 rounded-xl text-xs focus:outline-none"
              >
                {Object.values(allWeeks).map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.meta?.dateRange})</option>
                ))}
              </select>

              <button
                onClick={() => setIsWeekModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Semana</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Clock In Button */}
            <button
              onClick={() => setIsClockInModalOpen(true)}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Clock className="w-4 h-4" />
              <span>⏱️ Fichar Jornada</span>
            </button>

            {/* Payroll & Hours Report */}
            <button
              onClick={() => setIsPayrollModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 border border-amber-500/30 transition-all"
            >
              <DollarSign className="w-4 h-4" />
              <span>💶 Horas & Nóminas</span>
            </button>

            {/* Gemini AI Button */}
            <button
              onClick={() => setIsGeminiModalOpen(true)}
              className="bg-gradient-to-r from-amber-500 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Wand2 className="w-4 h-4" />
              <span>✨ Gemini AI</span>
            </button>

            {/* Share Worker Links Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
          </div>
        </header>

        {/* Worker Specific Banner if active */}
        {activeWorker && (
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 text-white p-5 rounded-2xl border border-blue-800 shadow-md flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-3xl">
                {WORKERS_LIST.find(w => w.name === activeWorker)?.avatar || "👤"}
              </div>
              <div>
                <span className="text-xs font-semibold text-blue-300 uppercase tracking-wider block">Vista Personalizada</span>
                <h2 className="text-lg font-bold">Planificación de {activeWorker} — {activeWeek.name}</h2>
                <div className="flex items-center space-x-2 text-xs text-slate-300 mt-0.5">
                  <span>{WORKERS_LIST.find(w => w.name === activeWorker)?.role}</span>
                  <span>•</span>
                  {WORKERS_LIST.find(w => w.name === activeWorker)?.isPayroll ? (
                    <span className="text-amber-400 font-semibold">Nómina Fija</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold">Extra (10 €/h)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsClockInModalOpen(true)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md"
              >
                ⏱️ Fichar Ahora
              </button>

              <button
                onClick={() => {
                  setActiveWorker(null);
                  window.history.pushState({}, '', window.location.pathname);
                }}
                className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Ver Todo
              </button>
            </div>
          </div>
        )}

        {/* Team Members Section */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="text-blue-600 w-4 h-4" /> Equipo, Nóminas y Extras ({WORKERS_LIST.length} Miembros)
            </h2>
            <span className="text-[11px] text-slate-400">Haz clic en un trabajador para filtrar sus tareas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {WORKERS_LIST.map((w, idx) => (
              <div 
                key={idx} 
                onClick={() => setActiveWorker(w.name === activeWorker ? null : w.name)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center space-x-3 ${
                  activeWorker === w.name 
                    ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-500/20' 
                    : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="text-2xl">{w.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 truncate">{w.name}</span>
                    {w.isPayroll ? (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Nómina</span>
                    ) : (
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">10€/h</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 block truncate mt-0.5">{w.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule Days Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Object.entries(activeWeek.schedule || {}).map(([key, day]) => (
            <div key={key} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Calendar className="text-blue-600 w-4 h-4" /> {day.title}
                </h3>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">{day.badge}</span>
              </div>

              <ul className="space-y-2 text-xs text-slate-600">
                {(day.tasks || []).map((task, idx) => {
                  const taskText = typeof task === 'object' ? task.text : task;
                  const isCompleted = typeof task === 'object' ? task.completed : false;

                  return (
                    <li 
                      key={idx} 
                      onClick={() => toggleTask(key, idx)}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-900 line-through' : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <Clock className="text-slate-400 w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div>{taskText}</div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Saturday Special Section */}
        {activeWeek.saturdaySpecial && (
          <section className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Fire className="text-amber-400 w-5 h-5" /> {activeWeek.saturdaySpecial.title}
              </h3>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2.5 py-1 rounded-lg border border-amber-400/30">Día Clave</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {(activeWeek.saturdaySpecial.weddings || []).map((w, idx) => (
                <div key={idx} className="bg-white/10 p-4 rounded-xl border border-white/10">
                  <span className="font-bold text-amber-300 block mb-1">🏔️ {w.location}</span>
                  <span className="text-slate-300 block mb-2 font-medium">{w.truck}</span>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{w.details}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Sunday / Monday Section */}
        {activeWeek.sundayMonday && (
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
              <Broom className="text-blue-600 w-4 h-4" /> {activeWeek.sundayMonday.title}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
              {(activeWeek.sundayMonday.tasks || []).map((task, idx) => {
                const taskText = typeof task === 'object' ? task.text : task;
                return (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                    {taskText}
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </div>

      {/* Share Modal */}
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
                <h3 className="text-xl font-bold font-['Outfit']">Enlaces Personales para WhatsApp</h3>
                <p className="text-xs text-slate-400">Envía a cada trabajador su enlace de fichaje y tareas</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {WORKERS_LIST.map((w, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                      className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center space-x-1.5 transition-colors"
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
                      className="flex-1 sm:flex-none px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-emerald-600/20"
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

      {/* Clock In Modal */}
      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        workersList={WORKERS_LIST}
        initialWorkerName={activeWorker}
        onClockEntryCreated={handleClockEntryCreated}
      />

      {/* Payroll Report Modal */}
      <PayrollReportModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        entries={clockEntries}
        workersList={WORKERS_LIST}
        onClearEntries={handleClearClockEntries}
      />

      {/* Week Manager Modal */}
      <WeekManagerModal
        isOpen={isWeekModalOpen}
        onClose={() => setIsWeekModalOpen(false)}
        onCreateWeek={handleCreateWeek}
        currentWeekName={activeWeek.name}
      />

      {/* Gemini AI Assistant Modal */}
      <GeminiAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        onApplyGeneratedSchedule={handleApplyGeminiSchedule}
      />
    </div>
  );
}
