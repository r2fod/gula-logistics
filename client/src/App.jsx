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
  ChevronDown
} from 'lucide-react';

import WeekManagerModal from './components/WeekManagerModal';
import GeminiAssistantModal from './components/GeminiAssistantModal';

const BASE_WEEK_3 = {
  id: "week_3",
  name: "Semana 3",
  meta: {
    week: "Semana 3",
    dateRange: "Del 15 al 20 de Septiembre de 2026",
    status: "Operativa Activa"
  },
  schedule: {
    martes: {
      title: "Martes 15", badge: "Arranque Flota",
      tasks: [
        { id: "m1", text: "09:00 - 11:30: Recogida Camión Albacar (Gonzalo y Ricardo). ¡Flota completa de 3!", assigned: ["Gonzalo", "Ricardo"], completed: false },
        { id: "m2", text: "12:00 - 14:00: Ruta Carvillo — Recogida 90 sillas extra.", assigned: ["Gonzalo", "Ricardo"], completed: false },
        { id: "m3", text: "15:30 - 18:30: Ruta Dealde — Recogida material alquiler.", assigned: ["Gonzalo", "Ricardo"], completed: false }
      ]
    },
    miercoles: {
      title: "Miércoles 16", badge: "Descarga Fincas",
      tasks: [
        { id: "mc1", text: "10:00 - 14:00: Pre-carga en almacén (Johan y Jeferson).", assigned: ["Johan", "Jeferson"], completed: false },
        { id: "mc2", text: "15:00 - 19:00: Descarga adelantada en Mas dels Refranys y Villajoyosa (Gonzalo, Ricardo, Johan).", assigned: ["Gonzalo", "Ricardo", "Johan"], completed: false }
      ]
    },
    jueves: {
      title: "Jueves 17", badge: "Eventos",
      tasks: [
        { id: "j1", text: "08:00 - 14:00: Catering Encamina (100 pax) - Anto, Marc, Luis.", assigned: ["Raúl", "Irene"], completed: false },
        { id: "j2", text: "15:00 - 19:00: Evento SUOT - Control y servicio.", assigned: ["Raúl"], completed: false },
        { id: "j3", text: "19:00 - 21:00: Pre-carga de frío y revisión de checklists.", assigned: ["Irene", "Jeferson"], completed: false }
      ]
    },
    viernes: {
      title: "Viernes 18", badge: "Cierre Crítico",
      tasks: [
        { id: "v1", text: "09:00 - 14:00: 2º viaje adelantado y descarga de menaje en Chera.", assigned: ["Gonzalo", "Ricardo"], completed: false },
        { id: "v2", text: "15:00 - 21:00: Estiba, flejado y carga final en 3 camiones. Raúl e Irene validan albaranes.", assigned: ["Raúl", "Irene", "Johan", "Jeferson"], completed: false }
      ]
    }
  },
  saturdaySpecial: {
    title: "Sábado 19 — El Gran Día (3 Bodas Simultáneas)",
    weddings: [
      { location: "Sot de Chera (250 pax)", truck: "Camión 1 (Gran Vol.)", details: "Conduce: Ricardo | Apoyo: Jeferson. 🌙 Viaje nocturno de vuelta.", assigned: ["Ricardo", "Jeferson"] },
      { location: "Mas dels Refranys", truck: "Camión 2 (Rocío)", details: "Conduce: Gonzalo | Apoyo: Johan. ✅ Descarga hecha el miércoles.", assigned: ["Gonzalo", "Johan"] },
      { location: "María y Joaquín", truck: "Camión 3 (Albacar)", details: "Conduce: Jaime (Guiado) | Apoyo: Johan/Jef.", assigned: ["Jaime", "Johan", "Jeferson"] }
    ]
  },
  sundayMonday: {
    title: "Domingo 20 & Lunes 21 — Logística Inversa y Limpieza",
    tasks: [
      { id: "dl1", text: "Domingo (09:00 - 13:00): Descarga general de los 3 camiones en almacén. Limpieza de vajilla a cargo de Kerly + Jose (o Jeferson).", assigned: ["Jeferson", "Johan"], completed: false },
      { id: "dl2", text: "Devoluciones: Devolución del Camión Albacar (Gonzalo/Ricardo). Ruta a Dealde y 90 sillas a Carvillo el lunes.", assigned: ["Gonzalo", "Ricardo"], completed: false }
    ]
  }
};

const WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión 1 / Albacar", avatar: "🚛" },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión 1 (Gran Vol.)", avatar: "🚚" },
  { name: "Jaime", role: "Conductor Flota (Guiado)", truck: "Camión 3 (Albacar)", avatar: "🚛" },
  { name: "Johan", role: "Conductor & Backup", truck: "Camión 2 / Apoyo", avatar: "🚚" },
  { name: "Irene", role: "Base & Checklist", truck: "Almacén Base", avatar: "📦" },
  { name: "Jeferson", role: "Apoyo Logística & Prep", truck: "Base / Camión 1", avatar: "📦" },
  { name: "Raúl", role: "Jefe de Logística", truck: "Supervisión Flota", avatar: "📋" }
];

export default function App() {
  const [allWeeks, setAllWeeks] = useState(() => {
    try {
      const saved = localStorage.getItem('gula_logistics_all_weeks_v5');
      return saved ? JSON.parse(saved) : { week_3: BASE_WEEK_3 };
    } catch {
      return { week_3: BASE_WEEK_3 };
    }
  });

  const [activeWeekId, setActiveWeekId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    return (weekParam && allWeeks[weekParam]) ? weekParam : 'week_3';
  });

  const [activeWorker, setActiveWorker] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [copiedWorker, setCopiedWorker] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(new Date().toLocaleTimeString());

  // Detect worker from URL ?worker=Name
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get('worker');
    if (workerParam) {
      const matched = WORKERS_LIST.find(w => w.name.toLowerCase() === workerParam.toLowerCase());
      if (matched) setActiveWorker(matched.name);
    }
  }, []);

  // Sync to localStorage
  const updateWeeks = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v5', JSON.stringify(newWeeks));
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (e) {
      console.error(e);
    }
  };

  const activeWeek = allWeeks[activeWeekId] || BASE_WEEK_3;

  // Toggle Task Completion
  const toggleTask = (dayKey, taskId) => {
    const currentSchedule = { ...activeWeek.schedule };
    if (currentSchedule[dayKey]) {
      currentSchedule[dayKey].tasks = currentSchedule[dayKey].tasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      const updatedWeek = { ...activeWeek, schedule: currentSchedule };
      updateWeeks({ ...allWeeks, [activeWeekId]: updatedWeek });
    }
  };

  const toggleSundayTask = (taskId) => {
    const newSundayTasks = activeWeek.sundayMonday.tasks.map(t => 
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const updatedWeek = {
      ...activeWeek,
      sundayMonday: { ...activeWeek.sundayMonday, tasks: newSundayTasks }
    };
    updateWeeks({ ...allWeeks, [activeWeekId]: updatedWeek });
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

    const newWeeksState = { ...allWeeks, [newId]: newWeekObj };
    updateWeeks(newWeeksState);
    setActiveWeekId(newId);
  };

  // Apply Gemini AI Generated Schedule
  const handleApplyGeminiSchedule = (aiGeneratedJson) => {
    const updatedWeek = {
      ...activeWeek,
      meta: {
        ...activeWeek.meta,
        ...aiGeneratedJson.meta
      },
      schedule: aiGeneratedJson.schedule || activeWeek.schedule,
      saturdaySpecial: aiGeneratedJson.saturdaySpecial || activeWeek.saturdaySpecial,
      sundayMonday: aiGeneratedJson.sundayMonday || activeWeek.sundayMonday
    };

    updateWeeks({ ...allWeeks, [activeWeekId]: updatedWeek });
  };

  // Links generator
  const getWorkerLink = (workerName) => {
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    return `${baseUrl}?week=${activeWeekId}&worker=${encodeURIComponent(workerName)}`;
  };

  const copyWorkerLink = (workerName) => {
    navigator.clipboard.writeText(getWorkerLink(workerName));
    setCopiedWorker(workerName);
    setTimeout(() => setCopiedWorker(null), 3000);
  };

  const shareViaWhatsApp = (workerName) => {
    const link = getWorkerLink(workerName);
    const text = `🚚 Hola ${workerName}, aquí tienes tu planificación para la ${activeWeek.name} de Gula Logística: ${link}`;
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
                title="Añadir Nueva Semana"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Semana</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Gemini AI Assistant Button */}
            <button
              onClick={() => setIsGeminiModalOpen(true)}
              className="bg-gradient-to-r from-amber-500 via-amber-400 to-indigo-500 hover:opacity-95 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Wand2 className="w-4 h-4" />
              <span>✨ Gemini AI Assistant</span>
            </button>

            {/* Share Worker Links Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>Enlaces WhatsApp</span>
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
                <p className="text-xs text-slate-300">
                  {WORKERS_LIST.find(w => w.name === activeWorker)?.truck || "Flota Gula"}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveWorker(null);
                window.history.pushState({}, '', window.location.pathname);
              }}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Ver Todo el Equipo
            </button>
          </div>
        )}

        {/* Team Members Section */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="text-blue-600 w-4 h-4" /> Equipo y Estructura Operativa ({activeWeek.name})
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
                  <span className="font-bold text-slate-800 block truncate">{w.name}</span>
                  <span className="text-[11px] text-slate-500 block truncate">{w.role}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule Days Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Object.entries(activeWeek.schedule || {}).map(([key, day]) => {
            const dayTasks = activeWorker 
              ? day.tasks.filter(t => t.assigned && t.assigned.includes(activeWorker))
              : day.tasks;

            if (activeWorker && dayTasks.length === 0) return null;

            return (
              <div key={key} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Calendar className="text-blue-600 w-4 h-4" /> {day.title}
                    </h3>
                    <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md">{day.badge}</span>
                  </div>

                  <ul className="space-y-2 text-xs text-slate-600">
                    {dayTasks.map((task) => (
                      <li 
                        key={task.id} 
                        onClick={() => toggleTask(key, task.id)}
                        className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          task.completed 
                            ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900 line-through' 
                            : 'bg-slate-50 border-slate-100 hover:border-blue-300'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border mt-0.5 shrink-0 transition-colors ${
                          task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div className="flex-1">
                          <span>{task.text}</span>
                          {task.assigned && task.assigned.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5">
                              {task.assigned.map((name, i) => (
                                <span 
                                  key={i} 
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                                    name === activeWorker ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
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
              {(activeWeek.saturdaySpecial.weddings || []).map((w, idx) => {
                const isAssignedToActiveWorker = activeWorker && w.assigned && w.assigned.includes(activeWorker);
                return (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-xl border transition-all ${
                      isAssignedToActiveWorker 
                        ? 'bg-blue-600/30 border-blue-400 ring-2 ring-blue-400/40' 
                        : 'bg-white/10 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-amber-300 block">🏔️ {w.location}</span>
                      {isAssignedToActiveWorker && (
                        <span className="text-[9px] bg-blue-500 text-white px-1.5 py-0.5 rounded font-bold">Tu Asignación</span>
                      )}
                    </div>
                    <span className="text-slate-300 block mb-2 font-medium">{w.truck}</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{w.details}</p>
                  </div>
                );
              })}
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
              {(activeWeek.sundayMonday.tasks || []).map((task) => (
                <div 
                  key={task.id}
                  onClick={() => toggleSundayTask(task.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                    task.completed ? 'bg-emerald-50 border-emerald-200 text-emerald-900 line-through' : 'bg-slate-50 border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center border mt-0.5 shrink-0 transition-colors ${
                    task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <span>{task.text}</span>
                </div>
              ))}
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
                <p className="text-xs text-slate-400">Envía a cada trabajador su vista de la {activeWeek.name}</p>
              </div>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {WORKERS_LIST.map((w, idx) => (
                <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{w.avatar}</span>
                    <div>
                      <h4 className="font-bold text-white text-sm">{w.name}</h4>
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
