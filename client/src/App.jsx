import React, { useState, useEffect } from 'react';
import {
  Share2,
  Check,
  Copy,
  X,
  MessageCircle,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

import WeekManagerModal from './components/WeekManagerModal';
import GeminiAssistantModal from './components/GeminiAssistantModal';
import ClockInModal from './components/ClockInModal';
import PayrollReportModal from './components/PayrollReportModal';
import PartnerDashboardView from './components/PartnerDashboardView';
import AdminWorkerEditorModal from './components/AdminWorkerEditorModal';
import AdminTaskEditorModal from './components/AdminTaskEditorModal';

import WorkerView from './components/WorkerView';
import PublicView from './components/PublicView';
import BackgroundAnimation from './components/BackgroundAnimation';
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
  saveWeeksToAPI,
  patchTaskCompletionInAPI,
  saveWorkerBalanceToAPI
} from './data/apiService';
import { initialBalancesData } from './data/balancesData';
import { getActiveShiftForWorker } from './data/shiftCalculations';
import { getTaskListForDay, buildTaskListPatch } from './data/taskPlanning';

const DEFAULT_WORKERS_LIST = [
  { name: "Gonzalo", role: "Conductor Flota (Veterano)", truck: "Camión Covey (Alquiler)", avatar: "🚛", isPayroll: false, rate: 10 },
  { name: "Ricardo", role: "Conductor Flota (Veterano)", truck: "Camión Gula (Propio)", avatar: "🚚", isPayroll: false, rate: 10 },
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

    // 3. Persist to API so it doesn't get wiped by fetchBalancesFromAPI
    saveWorkerBalanceToAPI(newBalanceProfile.id, newBalanceProfile).catch(err => {
      console.warn("Failed to persist new worker balance to API", err);
    });
  };

  // Quita a alguien del roster operativo (selectores de fichaje/asignación).
  // No borra su ficha en Saldos & Acuerdos ni sus fichajes históricos —
  // eso es un registro financiero, se mantiene aunque ya no esté activo.
  const handleRemoveWorker = (workerName) => {
    const updatedWorkers = workersList.filter(w => w.name !== workerName);
    setWorkersList(updatedWorkers);
    localStorage.setItem('gula_workers_v1', JSON.stringify(updatedWorkers));
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
    // El icono de la app instalada (PWA) siempre abre start_url del
    // manifest, SIN los parámetros de la URL original (?worker=...) — así
    // que un trabajador que instale su propio enlace perdía su identidad
    // en cada relanzamiento y caía al panel general. Se recuerda el
    // último trabajador válido en localStorage y se restaura solo si
    // sigue en el roster actual (si lo quitaste del equipo, no se
    // restaura — sigue revocado).
    //
    // Nunca en un dispositivo con sesión de admin real: si no, un admin que
    // abra el enlace de un trabajador para probarlo queda "atrapado" en esa
    // vista en cada carga siguiente sin parámetros, sin poder volver al
    // panel — pasó de verdad con el enlace de un trabajador nuevo.
    const hasAdminSession = !!getStoredAdminToken();
    if (workerParam) {
      const matched = workersList.find(w => w.name.toLowerCase() === workerParam.toLowerCase());
      if (matched) {
        setActiveWorker(matched.name);
        if (!hasAdminSession) {
          try { localStorage.setItem('gula_last_worker_v1', matched.name); } catch (e) {}
        }
      }
    } else if (!hasAdminSession) {
      try {
        const lastWorker = localStorage.getItem('gula_last_worker_v1');
        if (lastWorker) {
          const stillValid = workersList.find(w => w.name.toLowerCase() === lastWorker.toLowerCase());
          if (stillValid) setActiveWorker(stillValid.name);
          else localStorage.removeItem('gula_last_worker_v1');
        }
      } catch (e) {}
    }
    // ?view=saldos/acuerdos ya lo entiende PartnerDashboardView directamente
    // (lee ?tab=/?view= al montar y abre la pestaña 'balances' con datos
    // reales de la API) — no hace falta un modal aparte con datos viejos.

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

  // Solo actualiza el estado local (React + localStorage), sin tocar el
  // servidor — para los casos donde el guardado real se hace aparte con un
  // endpoint más estrecho (ver toggleTask/markTaskCompleted).
  const applyLocalWeeksState = (newWeeks) => {
    setAllWeeks(newWeeks);
    try {
      localStorage.setItem('gula_logistics_all_weeks_v10', JSON.stringify(newWeeks));
    } catch (e) {
      console.error(e);
    }
  };

  // Reemplaza el documento COMPLETO de la semana en el servidor (requiere
  // admin) — usar solo para guardados masivos de verdad (editor de tareas,
  // crear/clonar semana, aplicar plan de Gemini). Para marcar una tarea
  // como hecha, usar patchTaskCompletionInAPI vía toggleTask/markTaskCompleted.
  //
  // El cambio se aplica igualmente en local aunque falle el guardado real
  // (para no perder lo escrito), pero se avisa siempre que el servidor lo
  // rechace — si no, el cambio parece guardado y desaparece solo en el
  // siguiente refresco de 20s sin explicación (p.ej. sesión de admin
  // caducada o revocada tras cambiar la contraseña).
  const updateWeeks = async (newWeeks) => {
    applyLocalWeeksState(newWeeks);
    const result = await saveWeeksToAPI(newWeeks);
    if (!result) {
      alert('⚠️ No se pudo guardar en el servidor (posible sesión de administrador caducada). El cambio se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.');
    }
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

    // Al fichar salida de una tarea concreta (fichada con taskRef desde
    // "Fichar Esta Tarea" / "Fichar Entrada Ahora"), marcarla como hecha
    // sola en el planning — se busca en los fichajes previos a este (el
    // array `clockEntries` de este cierre, sin el `newEntry` todavía).
    if (newEntry.type === 'salida') {
      const closingShift = getActiveShiftForWorker(clockEntries, newEntry.workerName);
      if (closingShift?.taskRef) {
        markTaskCompleted(closingShift.taskRef.dayKey, closingShift.taskRef.taskIndex);
      }
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

  // Toggle tasks. dayKey 'domingo' es especial: agrupa las tareas de
  // domingo Y lunes bajo sundayMonday.tasks (no schedule.domingo, que ni
  // existe) — resuelto por taskPlanning.js, la única fuente de verdad sobre
  // dónde vive la lista de tareas de un día (ver comentario ahí).
  // Guarda solo en el servidor con PATCH /weeks/:weekId/tasks — no requiere
  // admin (a diferencia de saveWeeksToAPI/updateWeeks), así que es seguro
  // llamarlo desde la vista de un trabajador sin sesión.
  const toggleTask = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    const newCompleted = typeof taskItem === 'object' ? !taskItem.completed : true;
    if (typeof taskItem === 'object') {
      taskItem.completed = newCompleted;
    } else {
      list[taskIdx] = { text: taskItem, completed: newCompleted };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, newCompleted);
  };

  // Marca una tarea como hecha (nunca la desmarca) — usado al fichar salida
  // de una tarea concreta, para no tener que ir luego a tildarla a mano.
  const markTaskCompleted = (dayKey, taskIdx) => {
    const list = [...getTaskListForDay(activeWeek, dayKey)];
    const taskItem = list[taskIdx];
    if (taskItem === undefined) return;
    if (typeof taskItem === 'object') {
      if (taskItem.completed) return;
      taskItem.completed = true;
    } else {
      list[taskIdx] = { text: taskItem, completed: true };
    }
    applyLocalWeeksState({ ...allWeeks, [activeWeekId]: { ...activeWeek, ...buildTaskListPatch(activeWeek, dayKey, list) } });
    patchTaskCompletionInAPI(activeWeekId, dayKey, taskIdx, true);
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

  if (activeWorker) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-950 relative">
        <BackgroundAnimation viewMode="worker" />
        <WorkerView
          workerName={activeWorker}
          workersList={workersList}
          activeWeekData={activeWeek}
          clockEntries={clockEntries}
          isAdmin={isAdmin}
          onToggleTask={(dayKey, taskIdx) => toggleTask(dayKey, taskIdx)}
          onClockEntryCreated={handleClockEntryCreated}
          onUpdateClockEntry={handleUpdateClockEntry}
          onDeleteClockEntry={handleDeleteClockEntry}
          onOpenAdminDashboard={() => {
            if (isAdmin) {
              // Ya autenticado: ir directo al panel, sin pedir contraseña
              // otra vez. isPartnerMode se calculó en false al montar si
              // se entró por un enlace de trabajador (?worker=...), así
              // que hay que reactivarlo a mano para no caer en la vista
              // pública en vez de en el panel.
              setActiveWorker(null);
              try { localStorage.removeItem('gula_last_worker_v1'); } catch (e) {}
              clearUrlParams();
              setIsPartnerMode(true);
            } else {
              // Sin sesión: solo abrir el login, sin tocar la vista del
              // trabajador todavía — si cancela sin escribir la
              // contraseña, tiene que seguir viendo su propia vista tal
              // cual, no quedarse sin ningún sitio al que volver.
              setIsAdminLoginOpen(true);
            }
          }}
        />

        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={() => {
            setIsAdminUnlocked(true);
            setIsPartnerMode(true);
            setActiveWorker(null);
            try { localStorage.removeItem('gula_last_worker_v1'); } catch (e) {}
            clearUrlParams();
            setIsAdminLoginOpen(false);
          }}
        />
      </div>
    );
  }

  // Genuinely public, no-sensitive-data view: no saldos, no nóminas, no admin
  // controls, regardless of whether this browser also has an admin session.
  if (isPublicPreviewMode && !activeWorker) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans relative">
        <BackgroundAnimation viewMode="public" />
        <div className="w-full space-y-4 relative z-10">
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
          clockEntries={clockEntries}
          onClockEntryCreated={handleClockEntryCreated}
        />
      </div>
    );
  }

  // Nadie identificado (ni trabajador ni sesión de admin real): mostrar la
  // vista pública segura, no el panel de socias. `isPartnerMode` ya se
  // calculaba bien al montar (token de admin guardado, o algún flag
  // ?socias/?admin en la URL), pero no se estaba usando para decidir qué
  // se renderiza aquí — así que cualquiera sin sesión (incluido el icono
  // de la app instalada, que pierde los parámetros de la URL original al
  // abrirse) veía igualmente el Cuadrante/Saldos completos sin login.
  if (!isPartnerMode && !isAdmin) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans relative">
        <BackgroundAnimation viewMode="public" />
        <div className="w-full space-y-4 relative z-10">
          <PublicView
            data={activeWeek}
            workersList={workersList}
            clockEntries={clockEntries}
            onToggleTask={() => {}}
            onOpenLogin={() => setIsAdminLoginOpen(true)}
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
          clockEntries={clockEntries}
          onClockEntryCreated={handleClockEntryCreated}
        />

        <AdminLoginModal
          isOpen={isAdminLoginOpen}
          onClose={() => setIsAdminLoginOpen(false)}
          onSuccess={() => {
            setIsAdminUnlocked(true);
            setIsPartnerMode(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased selection:bg-amber-500 selection:text-slate-950 relative">
      <BackgroundAnimation viewMode="partner_planning" />
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
        clockEntries={clockEntries}
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

                    <button
                      onClick={() => window.open(getWorkerLink(w.name), '_blank')}
                      className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white flex items-center justify-center space-x-1.5 transition-colors shadow-md shadow-blue-600/20 whitespace-nowrap shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <AdminWorkerEditorModal
        isOpen={isWorkerEditorModalOpen}
        onClose={() => setIsWorkerEditorModalOpen(false)}
        workersList={workersList}
        onAddWorker={handleAddWorker}
        onRemoveWorker={handleRemoveWorker}
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
