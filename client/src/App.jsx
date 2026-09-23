import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ShieldCheck
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
import EnlacesWhatsAppModal from './components/EnlacesWhatsAppModal';
import { logisticsData as BASE_DATA } from './data/logisticsData';
import {
  fetchClockEntriesFromAPI,
  getStoredAdminToken,
  setStoredAdminToken,
  logoutAdmin,
  fetchWeeksFromAPI,
  fetchCalendarioApuntes,
  createDraftWeekInAPI,
  retryPendingClockEntries
} from './data/apiService';
import { getInProgressTaskKeys } from './data/shiftCalculations';
import { getWeekRange } from './data/taskPlanning';
import { anticiparSemanas } from './data/anticipacion';
import { semanaInicialDeEnlace } from './data/enlaces';
import { parseWeekRange } from './data/taskPlanning';

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

import { useWorkers } from './hooks/useWorkers';
import { useBalances } from './hooks/useBalances';
import { useClockings } from './hooks/useClockings';
import { useWeeks } from './hooks/useWeeks';
import { useDialog } from './contexts/DialogContext';

export default function App() {
  const { alert, confirm } = useDialog();
  const { workersList, setWorkersList, handleRemoveWorker } = useWorkers();
  const { balancesData, setBalancesData, handleAddWorker } = useBalances(workersList, setWorkersList);
  
  const {
    allWeeks,
    setAllWeeks,
    activeWeekId,
    setActiveWeekId,
    activeWeek,
    handleUpdateActiveWeek,
    toggleTask,
    markTaskCompleted,
    autoCompletePastTasks,
    handleCreateWeek,
    handleApplyGeminiSchedule,
    lastLocalEditRef
  } = useWeeks();

  // El efecto del sondeo de 20s se monta UNA vez ([] de dependencias), así
  // que llamaba siempre a la versión de autoCompletePastTasks de la primera
  // render — con la semana tal como estaba al abrir la app. Si desde
  // entonces las tareas ya se habían completado, esa copia vieja seguía
  // viéndolas pendientes y repetía el mismo PATCH cada 20s para siempre,
  // subiendo `updatedAt` en cada vuelta y haciendo que los guardados del
  // admin chocaran con "Alguien más ha guardado cambios". Con la ref, cada
  // tick usa la última versión (ve el estado real).
  const autoCompletePastTasksRef = useRef(autoCompletePastTasks);
  autoCompletePastTasksRef.current = autoCompletePastTasks;

  const {
    clockEntries,
    setClockEntries,
    activeClockEntries,
    deletedClockEntries,
    handleClockEntryCreated,
    handleUpdateClockEntry,
    handleDeleteClockEntry,
    handleRestoreClockEntry,
    handleClearClockEntries
  } = useClockings(markTaskCompleted);

  // Tareas en las que alguien está fichado ahora mismo: el reloj no las da por
  // hechas mientras tanto ("en proceso"). Por ref, igual que arriba, porque el
  // sondeo de 20s no se vuelve a montar.
  const inProgressKeysRef = useRef(new Set());
  const inProgressKeys = useMemo(() => getInProgressTaskKeys(activeClockEntries), [activeClockEntries]);
  inProgressKeysRef.current = inProgressKeys;

  // Anticipación automática de semanas (desde el calendario, como BORRADOR).
  // Solo con sesión de admin; como mucho cada 6 h por navegador; idempotente
  // (el servidor no duplica ni pisa) y silenciosa si el calendario no está
  // configurado. Por ref porque el efecto que la dispara se monta una vez.
  const [avisoAnticipacion, setAvisoAnticipacion] = useState(null);
  const anticipacionEnCursoRef = useRef(false);
  const ejecutarAnticipacion = async (force = false) => {
    if (!getStoredAdminToken() || anticipacionEnCursoRef.current) return;
    const CLAVE = 'gula_anticipacion_v1';
    let ultima = 0;
    try { ultima = Number(localStorage.getItem(CLAVE) || 0); } catch { /* sin almacenamiento */ }
    if (!force && (Date.now() - ultima < 6 * 60 * 60 * 1000)) return;
    anticipacionEnCursoRef.current = true;
    try {
      const semanas = await fetchWeeksFromAPI();
      if (!semanas) return { ok: false };
      const r = await anticiparSemanas({
        semanas, hoy: new Date(), roster: workersList,
        leerApuntes: fetchCalendarioApuntes, crearBorrador: createDraftWeekInAPI,
      });
      if (r.estado === 'error') return { ok: false, error: r.error };
      if (r.estado === 'no-configurado') return { ok: false, error: 'El servidor aún no tiene configuradas las claves del calendario.' };
      try { localStorage.setItem(CLAVE, String(Date.now())); } catch { /* sin almacenamiento */ }
      if (r.creadas.length > 0) {
        const nuevas = await fetchWeeksFromAPI();
        if (nuevas) setAllWeeks(nuevas);
        setAvisoAnticipacion(`📅 Borrador${r.creadas.length > 1 ? 'es' : ''} preparado${r.creadas.length > 1 ? 's' : ''} desde el calendario: ${r.creadas.map(c => `${c.name} (${c.dateRange.replace(/^Del /, '')})`).join(' · ')}. Revísalo${r.creadas.length > 1 ? 's' : ''} y acéptalo${r.creadas.length > 1 ? 's' : ''} en el selector de semanas.`);
      }
      return { ok: true, creadas: r.creadas.length, omitidas: r.omitidas.length, detallesOmitidas: r.omitidas };
    } finally {
      anticipacionEnCursoRef.current = false;
    }
  };
  const ejecutarAnticipacionRef = useRef(ejecutarAnticipacion);
  ejecutarAnticipacionRef.current = ejecutarAnticipacion;

  // Primera pasada poco después de abrir la app y luego cada 30 min (el límite de
  // 6 h por navegador está dentro de ejecutarAnticipacion).
  useEffect(() => {
    const primera = setTimeout(() => ejecutarAnticipacionRef.current(), 4000);
    const ciclo = setInterval(() => ejecutarAnticipacionRef.current(), 30 * 60 * 1000);
    return () => { clearTimeout(primera); clearInterval(ciclo); };
  }, []);

  // Vuelve a generar un BORRADOR concreto desde el calendario (pierde sus cambios).
  const regenerarBorrador = async (weekId) => {
    const semanas = await fetchWeeksFromAPI();
    const semana = semanas?.[weekId];
    const rango = semana && parseWeekRange(semana.meta?.dateRange, new Date());
    if (!rango) { await alert('No se pudo leer el rango de fechas de esta semana.', { type: 'error' }); return; }
    
    const isConfirmed = await confirm('Se volverá a generar este borrador desde el calendario y se PERDERÁN los cambios que hayas hecho en él. ¿Continuar?', { type: 'warning' });
    if (!isConfirmed) return;
    
    const clave = `${rango.start.getFullYear()}-${String(rango.start.getMonth() + 1).padStart(2, '0')}-${String(rango.start.getDate()).padStart(2, '0')}`;
    const r = await anticiparSemanas({
      semanas, hoy: new Date(), roster: workersList,
      leerApuntes: fetchCalendarioApuntes, crearBorrador: createDraftWeekInAPI,
      inicios: [rango.start], reemplazar: true, idsForzados: { [clave]: weekId },
    });
    if (r.estado === 'no-configurado') { await alert('El calendario no está configurado en el servidor (variables CALENDARIO_* en Render).', { type: 'error' }); return; }
    if (r.estado === 'error') { await alert(`No se pudo leer el calendario: ${r.error}`, { type: 'error' }); return; }
    if (r.creadas.length === 0) { await alert(`No se ha regenerado: ${r.omitidas[0]?.motivo || 'sin cambios'}.`, { type: 'info' }); return; }
    const nuevas = await fetchWeeksFromAPI();
    if (nuevas) setAllWeeks(nuevas);
  };


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

    // Qué semana se abre (ver data/enlaces.js): un trabajador siempre ve la de hoy,
    // aunque su enlace sea uno viejo con ?week=; un borrador solo lo abre un admin.
    const hasAdminSession = !!getStoredAdminToken();
    const semanaInicial = semanaInicialDeEnlace({ weekParam, workerParam, hayAdmin: hasAdminSession, semanas: allWeeks });
    if (semanaInicial) setActiveWeekId(semanaInicial);
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
      // Ya está guardado en localStorage — quitarlo de la barra de
      // direcciones ahora mismo. Sin esto, el token seguía viajando en la
      // URL visible (capturas de pantalla, historial del navegador) y, si
      // alguien pulsaba un enlace saliente de la propia app (ej. Google
      // Maps de una tarea) antes de que <meta name="referrer"> existiera,
      // se filtraba entero en la cabecera Referer de esa petición externa.
      // Se quita solo `token`/`key` (no clearUrlParams(), que borra TODOS
      // los parámetros) para no perder otros como ?week= en el mismo enlace.
      try {
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('token');
        cleanUrl.searchParams.delete('key');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
      } catch (e) {
        console.error(e);
      }
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
        // Con las semanas ya al día se vuelve a decidir cuál abrir: la que contiene
        // HOY (nunca un borrador) salvo ?week= de un admin.
        const semanaActual = semanaInicialDeEnlace({ weekParam, workerParam, hayAdmin: hasAdminSession, semanas: remoteWeeks });
        if (semanaActual) setActiveWeekId(semanaActual);
      }
    });
  }, []);

  // Poll for fresh clock entries so the Live Monitor reflects fichajes made
  // from other workers' own links (their phones) without a manual refresh.
  useEffect(() => {
    // Pasada inicial al montar, para ponerse al día con tareas que ya
    // pasaron mientras la app estaba cerrada — no solo esperar al primer
    // tick del intervalo de 20s.
    if (getStoredAdminToken()) {
      autoCompletePastTasksRef.current(inProgressKeysRef.current);
    }
    // En cuanto el móvil recupera cobertura, reintentar YA los fichajes
    // pendientes en vez de esperar hasta 20s al siguiente tick del
    // intervalo — importante en fincas de boda con cobertura intermitente.
    const handleOnline = () => { retryPendingClockEntries(); };
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      // Reintentar fichajes que se crearon sin cobertura o con el servidor
      // caído (para todos, no solo admin — cualquier trabajador puede
      // tener fichajes pendientes en su propio móvil).
      retryPendingClockEntries();
      fetchClockEntriesFromAPI().then(remoteEntries => {
        if (remoteEntries && Array.isArray(remoteEntries)) {
          setClockEntries(remoteEntries);
        }
      });
      // No sobreescribir semanas si el usuario ha tocado algo en los últimos 5s
      // (el PATCH puede tardar un poco en llegar al servidor y reflejarse en el GET)
      const msSinceLastEdit = Date.now() - (lastLocalEditRef?.current || 0);
      if (msSinceLastEdit > 5000) {
        fetchWeeksFromAPI().then(remoteWeeks => {
          if (remoteWeeks) setAllWeeks(remoteWeeks);
        });
      }
      // Auto-completar tareas pasadas (con margen) solo desde una sesión de
      // admin real — leído fresco en cada tick (no de un estado capturado
      // por el efecto, que quedaría desactualizado si el admin inicia
      // sesión después de montar la app) para que no lo dispare cada
      // trabajador desde su propio móvil a la vez.
      if (getStoredAdminToken()) {
        autoCompletePastTasksRef.current(inProgressKeysRef.current);
      }
    }, 20000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
    };
  }, []);



  // Admin mode state — the source of truth is the signed backend session
  // token (getStoredAdminToken), never a plain localStorage flag a visitor
  // could fake from devtools with localStorage.setItem('x', 'true').
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(() => !!getStoredAdminToken());
  const isAdmin = isAdminUnlocked;

  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdminUnlocked(false);
  };



  const handleJumpToVispera = async () => {
    // Buscar la semana cronológicamente anterior a la actual
    if (!activeWeek?.meta?.dateRange) return;
    
    // Sort weeks by their parsed date range start time. Fallback to ID-based sorting if unparseable.
    const currentWeekIds = Object.keys(allWeeks).sort((a, b) => {
      const rangeA = getWeekRange(allWeeks[a]);
      const rangeB = getWeekRange(allWeeks[b]);
      
      if (rangeA?.start && rangeB?.start) {
        return rangeA.start.getTime() - rangeB.start.getTime();
      }
      
      // Fallback a comparar por el número en el nombre o ID ("Semana 3" -> 3)
      const numA = parseInt(allWeeks[a]?.name?.match(/(\d+)/)?.[1] || a.match(/(\d+)/)?.[1]) || 0;
      const numB = parseInt(allWeeks[b]?.name?.match(/(\d+)/)?.[1] || b.match(/(\d+)/)?.[1]) || 0;
      
      return numA - numB;
    });

    const currentIndex = currentWeekIds.indexOf(activeWeekId);
    if (currentIndex > 0) {
      const prevWeekId = currentWeekIds[currentIndex - 1];
      setActiveWeekId(prevWeekId);
    } else {
      await alert("No se ha encontrado la semana anterior en el registro local.", { type: 'info' });
    }
  };

  if (activeWorker) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-950 relative">
        <BackgroundAnimation viewMode="worker" />
        <WorkerView
          workerName={activeWorker}
          workersList={workersList}
          activeWeekData={activeWeek}
          clockEntries={activeClockEntries}
          isAdmin={isAdmin}
          onToggleTask={(dayKey, taskIdx) => toggleTask(dayKey, taskIdx)}
          onClockEntryCreated={handleClockEntryCreated}
          onUpdateClockEntry={handleUpdateClockEntry}
          onDeleteClockEntry={handleDeleteClockEntry}
          onRestoreClockEntry={handleRestoreClockEntry}
          deletedClockEntries={deletedClockEntries}
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
            clockEntries={activeClockEntries}
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
          clockEntries={activeClockEntries}
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
            clockEntries={activeClockEntries}
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
          clockEntries={activeClockEntries}
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
        onUpdateWeek={handleUpdateActiveWeek}
        onRegenerateDraft={regenerarBorrador}
        anticipacionAviso={avisoAnticipacion}
        onCerrarAnticipacionAviso={() => setAvisoAnticipacion(null)}
        workersList={workersList}
        clockEntries={activeClockEntries}
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
        clockEntries={activeClockEntries}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <PayrollReportModal
        isOpen={isPayrollModalOpen}
        onClose={() => setIsPayrollModalOpen(false)}
        entries={activeClockEntries}
        workersList={workersList}
        onClearEntries={handleClearClockEntries}
        isAdmin={isAdmin}
        onUpdateEntry={handleUpdateClockEntry}
        onDeleteEntry={handleDeleteClockEntry}
        onRestoreEntry={handleRestoreClockEntry}
        onClockEntryCreated={handleClockEntryCreated}
        activeWeekData={activeWeek}
      />

      <WeekManagerModal
        isOpen={isWeekModalOpen}
        onClose={() => setIsWeekModalOpen(false)}
        onCreateWeek={handleCreateWeek}
        onForceAutoDraft={() => ejecutarAnticipacion(true)}
        currentWeekName={activeWeek.name}
        currentWeekTrucks={activeWeek.trucks || []}
        workersList={workersList}
      />

      <GeminiAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        onApplyGeneratedSchedule={handleApplyGeminiSchedule}
        activeWeekData={activeWeek}
      />

      <EnlacesWhatsAppModal
        abierto={isShareModalOpen}
        onCerrar={() => setIsShareModalOpen(false)}
        workersList={workersList}
      />

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
        onJumpToVispera={handleJumpToVispera}
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
