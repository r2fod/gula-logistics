import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import {
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

import ClockInModal from './components/ClockInModal';

import WorkerView from './components/WorkerView';
import PublicView from './components/PublicView';
import BackgroundAnimation from './components/BackgroundAnimation';
import AdminLoginModal from './components/AdminLoginModal';
// El panel de admin/socias y sus editores se descargan solo cuando hacen falta: un
// trabajador en su móvil no los usa (antes todo iba en un único archivo de ~1 MB).
const PartnerDashboardView = lazy(() => import('./components/PartnerDashboardView'));
const WeekManagerModal = lazy(() => import('./components/WeekManagerModal'));
const GeminiAssistantModal = lazy(() => import('./components/GeminiAssistantModal'));
const AdminWorkerEditorModal = lazy(() => import('./components/AdminWorkerEditorModal'));
const AdminTaskEditorModal = lazy(() => import('./components/AdminTaskEditorModal'));
const EnlacesWhatsAppModal = lazy(() => import('./components/EnlacesWhatsAppModal'));

const CargandoPanel = () => (
  <div role="status" className="flex min-h-[60vh] items-center justify-center gap-3 text-sm text-slate-400">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400 motion-reduce:animate-none" aria-hidden="true" />
    Cargando el panel…
  </div>
);
import { logisticsData as BASE_DATA } from './data/logisticsData';
import {
  fetchClockEntriesFromAPI,
  fetchClockEntryChangesFromAPI,
  guardarCopiaFichajes,
  getStoredAdminToken,
  setStoredAdminToken,
  getStoredSociasToken,
  setStoredSociasToken,
  guardarTokenTrabajador,
  comprobarSesionEnAPI,
  logoutAdmin,
  fetchWeeksFromAPI,
  fetchCalendarioApuntes,
  createDraftWeekInAPI,
  retryPendingClockEntries,
  deleteWeekFromAPI,
  saveWeeksToAPI,
  getAiMemories
} from './data/apiService';
import { pairShiftsFromEntries } from './data/shiftCalculations';
import { fichajesDeLaSemana, ultimaModificacion, fusionarCambiosFichajes } from './data/fichajes';
import { aprenderDeFichajes } from './data/aprendizajeFichajes';
import { semanaDeLaVispera } from './data/vispera';
import { getWeekRange } from './data/taskPlanning';
import { semanaPedidaEnEnlace } from './data/enlaces';
import { parseWeekRange } from './data/taskPlanning';

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
  const { workersList, setWorkersList, handleRemoveWorker, handleUpdateWorker } = useWorkers();
  const { balancesData, setBalancesData, handleAddWorker } = useBalances(workersList, setWorkersList);
  
  // Modals
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isClockInModalOpen, setIsClockInModalOpen] = useState(false);
  const [isWorkerEditorModalOpen, setIsWorkerEditorModalOpen] = useState(false);
  const [isTaskEditorModalOpen, setIsTaskEditorModalOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  const [activeWorker, setActiveWorker] = useState(null);
  // El enlace ?worker= se resuelve al abrir con la lista de equipo que haya en el
  // dispositivo; en un móvil nuevo esa lista es la de arranque y no trae a quien
  // entró hace poco, así que su enlace abría la vista pública hasta recargar. Ahora
  // se reconoce en cuanto llega el equipo real del servidor. (Salir de la vista del
  // trabajador limpia la URL, así que esto no le deja atrapado en ella.)
  const nombreEnlace = new URLSearchParams(window.location.search).get('worker');
  const trabajadorActivo = activeWorker
    || (nombreEnlace && workersList.find(w => w.name.toLowerCase() === nombreEnlace.toLowerCase())?.name)
    || null;

  const {
    allWeeks,
    setAllWeeks,
    activeWeekId,
    setActiveWeekId,
    activeWeek,
    handleUpdateActiveWeek,
    toggleTask,
    markTaskCompleted,
    handleCreateWeek,
    handleApplyGeminiSchedule,
    deshacerIa,
    cambiadaTrasIa,
    deshacerUltimaIa,
    olvidarDeshacerIa,
    lastLocalEditRef
  } = useWeeks({
    persona: trabajadorActivo,
    congelar: isTaskEditorModalOpen || isGeminiModalOpen || isWeekModalOpen || isClockInModalOpen,
  });

  const {
    clockEntries,
    setClockEntries,
    activeClockEntries,
    deletedClockEntries,
    handleClockEntryCreated,
    handleUpdateClockEntry,
    handleDeleteClockEntry,
    handleRestoreClockEntry
  } = useClockings(markTaskCompleted);

  // Fichajes SOLO de la semana activa para las vistas de los trabajadores y
  // nóminas (así ven solo su semana). Para el PartnerDashboard (saldos y
  // financiero) se usan todos (activeClockEntries) para no romper el histórico.
  // La ventana y los turnos abiertos los decide fichajesDeLaSemana (data/fichajes.js).
  const rangoSemanaActiva = useMemo(() => getWeekRange(activeWeek), [activeWeek]);
  const turnosFichados = useMemo(() => pairShiftsFromEntries(activeClockEntries), [activeClockEntries]);
  const currentWeekClockEntries = useMemo(() => {
    const abiertos = Object.values(turnosFichados.activeShifts);
    // fichajesDeLaSemana de data/fichajes.js se encarga de todo: 
    // ventana correcta [martes 00:00, martes siguiente 00:00) y turnos abiertos.
    return fichajesDeLaSemana(activeClockEntries, rangoSemanaActiva, abiertos);
  }, [activeClockEntries, turnosFichados, rangoSemanaActiva]);

  // Lo que el asistente aprende de los fichajes reales (duraciones y quién hace
  // qué): lo reciben Gemini (asistente y nueva semana) y el panel Memoria IA.
  const aprendizaje = useMemo(() => aprenderDeFichajes(turnosFichados.shifts, allWeeks), [turnosFichados, allWeeks]);

  // Anticipación automática de semanas (desde el calendario, como BORRADOR).
  // Solo con sesión de admin; como mucho cada 6 h por navegador; idempotente
  // (el servidor no duplica ni pisa) y silenciosa si el calendario no está
  // configurado. Por ref porque el efecto que la dispara se monta una vez.
  const [avisoAnticipacion, setAvisoAnticipacion] = useState(null);
  const anticipacionEnCursoRef = useRef(false);

  // Tras crear o regenerar borradores, Gemini los revisa una vez (modo barato: solo
  // cambios, editorIa.js) y se guarda lo que cambió en meta.revisionIa; el admin da
  // el toque final al aceptarlos. Sin clave o si falla, el borrador se queda como salió
  // del calendario. Se carga aparte para no pesar en la vista del trabajador.
  const revisarBorradoresConIa = async (weekIds, semanas) => {
    const [{ revisarBorradorConGemini }, { GEMINI_API_KEY_STORAGE_KEY }] = await Promise.all([import('./data/editorIa'), import('./data/geminiScheduleService')]);
    let apiKey = '';
    try { apiKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || ''; } catch { /* sin almacenamiento: la del servidor */ }
    const memorias = await getAiMemories().catch(() => []);
    let revisadas = 0;
    for (const weekId of weekIds) {
      const semana = semanas?.[weekId];
      if (!semana) continue;
      const r = await revisarBorradorConGemini({ semana, apiKey, equipo: workersList, memorias, aprendizaje });
      if (r.errorMsg) continue;
      const revisionIa = { el: new Date().toISOString(), cambios: r.aplicados || 0, tokens: r.uso?.total || 0 };
      const guardado = await saveWeeksToAPI({ [weekId]: { ...semana, ...(r.generatedJson || {}), meta: { ...semana.meta, revisionIa } } });
      if (guardado && !guardado.conflict) revisadas += 1;
    }
    if (revisadas) {
      const nuevas = await fetchWeeksFromAPI();
      if (nuevas) setAllWeeks(nuevas);
    }
    return revisadas;
  };
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
      // Solo lo usa el admin: se carga aparte (generador + optimizador) para no pesar en la vista del trabajador.
      const { anticiparSemanas } = await import('./data/anticipacion');
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
        const revisadas = nuevas ? await revisarBorradoresConIa(r.creadas.map(c => c.weekId), nuevas) : 0;
        setAvisoAnticipacion(`📅 Borrador${r.creadas.length > 1 ? 'es' : ''} preparado${r.creadas.length > 1 ? 's' : ''} desde el calendario${revisadas ? ' y revisado por Gemini' : ''}: ${r.creadas.map(c => `${c.name} (${c.dateRange.replace(/^Del /, '')})`).join(' · ')}. Revísalo${r.creadas.length > 1 ? 's' : ''} y acéptalo${r.creadas.length > 1 ? 's' : ''} en el selector de semanas.`);
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
    const { anticiparSemanas } = await import('./data/anticipacion');
    const r = await anticiparSemanas({
      semanas, hoy: new Date(), roster: workersList,
      leerApuntes: fetchCalendarioApuntes, crearBorrador: createDraftWeekInAPI,
      inicios: [rango.start], reemplazar: true, idsForzados: { [clave]: weekId },
    });
    if (r.estado === 'no-configurado') { await alert('El calendario no está configurado en el servidor (variables CALENDARIO_* en Render).', { type: 'error' }); return; }
    if (r.estado === 'error') { await alert(`No se pudo leer el calendario: ${r.error}`, { type: 'error' }); return; }
    if (r.creadas.length === 0) { await alert(`No se ha regenerado: ${r.omitidas[0]?.motivo || 'sin cambios'}.`, { type: 'info' }); return; }
    const nuevas = await fetchWeeksFromAPI();
    if (nuevas) {
      setAllWeeks(nuevas);
      await revisarBorradoresConIa([weekId], nuevas);
    }
  };

  const eliminarSemana = async (weekId) => {
    const isConfirmed = await confirm('¿Estás seguro de que quieres eliminar esta semana permanentemente? Esta acción no se puede deshacer.', { type: 'warning' });
    if (!isConfirmed) return;
    
    const res = await deleteWeekFromAPI(weekId);
    if (res && res.success) {
      const nuevas = await fetchWeeksFromAPI();
      if (nuevas) {
        setAllWeeks(nuevas);
        // Si era la que se veía, se vuelve a la de hoy.
        if (activeWeekId === weekId) setActiveWeekId(null);
      }
    } else {
      await alert(`Error al eliminar la semana: ${res?.message || 'Error desconocido'}`, { type: 'error' });
    }
  };


  const [isPublicPreviewMode, setIsPublicPreviewMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') === 'public';
  });
  // El panel (planificación + saldos) solo se abre con acceso REAL: sesión de admin
  // o enlace de socias de solo lectura (`acceso=`). Antes bastaba `?socias` o
  // `?admin` en la URL y los saldos salían de un endpoint público.
  const [isPartnerMode, setIsPartnerMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('worker') || params.get('view') === 'public') return false;
    return !!(getStoredAdminToken() || getStoredSociasToken() || params.get('token') || params.get('key') || params.get('acceso'));
  });
  // Aviso en la vista pública cuando un enlace de socias ya no da acceso.
  const [avisoAcceso, setAvisoAcceso] = useState('');

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
    const accesoParam = params.get('acceso');
    // `t=`: enlace firmado de un trabajador (?worker=Nombre&t=…): con él ve su saldo.
    const tokenTrabajadorParam = workerParam ? params.get('t') : null;
    const hasSociasFlag = params.has('socias');

    // Qué semana se abre (ver data/enlaces.js): un trabajador siempre ve la de hoy,
    // aunque su enlace sea uno viejo con ?week=; un borrador solo lo abre un admin.
    // Sin ?week= no se fija ninguna: la app sigue sola la de hoy (useWeeks).
    const hasAdminSession = !!getStoredAdminToken();
    const semanaPedida = semanaPedidaEnEnlace({ weekParam, workerParam, hayAdmin: hasAdminSession, semanas: allWeeks });
    if (semanaPedida) setActiveWeekId(semanaPedida);
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
          // Solo se olvida si el equipo ya se conoce: con la lista aún vacía (móvil
          // sin equipo guardado) no se sabe si esa persona sigue.
          else if (workersList.length) localStorage.removeItem('gula_last_worker_v1');
        }
      } catch (e) {}
    }
    // ?view=saldos/acuerdos ya lo entiende PartnerDashboardView directamente
    // (lee ?tab=/?view= al montar y abre la pestaña 'balances' con datos
    // reales de la API) — no hace falta un modal aparte con datos viejos.

    // `acceso=`: enlace de socias de SOLO LECTURA (lo genera el servidor).
    // `token=`/`key=`: sesión de admin en la URL — solo la de enlaces viejos;
    // la app ya no la mete en ningún enlace, y cambiar la clave la anula.
    if (accesoParam) setStoredSociasToken(accesoParam);
    if (tokenTrabajadorParam) guardarTokenTrabajador(workerParam, tokenTrabajadorParam);
    if (tokenParam) {
      setStoredAdminToken(tokenParam, Date.now() + 30 * 24 * 60 * 60 * 1000);
      setIsAdminUnlocked(true);
    }
    if (tokenParam || accesoParam || tokenTrabajadorParam) {
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
        cleanUrl.searchParams.delete('acceso');
        cleanUrl.searchParams.delete('t');
        window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search);
      } catch (e) {
        console.error(e);
      }
    }
    if (tokenParam || accesoParam) setIsPartnerMode(true);
    else if (hasSociasFlag && !hasAdminSession && !getStoredSociasToken()) {
      setAvisoAcceso('Este enlace de socias ya no da acceso. Pide al administrador el enlace nuevo.');
    }

    // Un enlace de socias guardado puede haber caducado o haberse anulado: se
    // comprueba al abrir para no enseñar un panel sin datos. Si no se puede
    // comprobar (sin red, servidor dormido) no se cierra nada.
    if (!hasAdminSession && (accesoParam || getStoredSociasToken())) {
      comprobarSesionEnAPI().then(rol => {
        if (rol !== null) return;
        logoutAdmin();
        setIsPartnerMode(false);
        setAvisoAcceso('Tu enlace de socias ha caducado o se ha anulado. Pide uno nuevo al administrador.');
      });
    }

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
        // El ?week= puede ser de una semana que este dispositivo aún no tenía.
        const pedidaEnServidor = semanaPedidaEnEnlace({ weekParam, workerParam, hayAdmin: hasAdminSession, semanas: remoteWeeks });
        if (pedidaEnServidor) setActiveWeekId(pedidaEnServidor);
      }
    });
  }, []);

  // Poll for fresh clock entries so the Live Monitor reflects fichajes made
  // from other workers' own links (their phones) without a manual refresh.
  // Solo se descarga el histórico entero al abrir y cada 10 min (red de seguridad);
  // el resto de ciclos piden lo cambiado desde el último fichaje visto (?desde=).
  const cursorFichajesRef = useRef(null);
  const ultimaCompletaRef = useRef(0);
  useEffect(() => {
    const sincronizarFichajes = async () => {
      const toca = !cursorFichajesRef.current || Date.now() - ultimaCompletaRef.current > 10 * 60 * 1000;
      if (toca) {
        const todos = await fetchClockEntriesFromAPI();
        if (!Array.isArray(todos)) return;
        // Al abrir, una lista vacía no pisa la copia local (puede ser el servidor despertando).
        if (todos.length > 0 || cursorFichajesRef.current) setClockEntries(todos);
        cursorFichajesRef.current = ultimaModificacion(todos);
        ultimaCompletaRef.current = Date.now();
        return;
      }
      // 30 s de margen: dos fichajes guardados a la vez pueden llegar a la base
      // en otro orden; lo repetido se descarta al fusionar (mismo updatedAt).
      const desde = new Date(Date.parse(cursorFichajesRef.current) - 30 * 1000).toISOString();
      const cambios = await fetchClockEntryChangesFromAPI(desde);
      if (!cambios?.length) return;
      cursorFichajesRef.current = ultimaModificacion([...cambios, { updatedAt: cursorFichajesRef.current }]);
      setClockEntries(prev => {
        const siguiente = fusionarCambiosFichajes(prev, cambios);
        if (siguiente !== prev) guardarCopiaFichajes(siguiente);
        return siguiente;
      });
    };
    sincronizarFichajes();

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
      sincronizarFichajes();
      // No sobreescribir semanas si el usuario ha tocado algo en los últimos 5s
      // (el PATCH puede tardar un poco en llegar al servidor y reflejarse en el GET)
      const msSinceLastEdit = Date.now() - (lastLocalEditRef?.current || 0);
      if (msSinceLastEdit > 5000) {
        fetchWeeksFromAPI().then(remoteWeeks => {
          if (remoteWeeks) setAllWeeks(remoteWeeks);
        });
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

  // Salir cierra también el enlace de socias de este navegador y vuelve a la
  // vista pública: sin acceso, el panel ya no tiene saldos que enseñar.
  const handleAdminLogout = () => {
    logoutAdmin();
    setIsAdminUnlocked(false);
    setIsPartnerMode(false);
  };



  // Del editor de una semana al de la semana donde está guardado su lunes de
  // víspera (semanaDeLaVispera). El editor solo carga su copia de la semana al
  // ABRIRSE: antes se cambiaba la semana activa con el editor abierto, que seguía
  // enseñando la semana de antes, y "Guardar" la mandaba con la clave de la otra
  // semana (el servidor lo rechazaba como conflicto y se perdían los cambios). Ahora
  // se avisa de que lo no guardado se pierde, se cierra, se cambia y se reabre.
  const handleJumpToVispera = async () => {
    const vispera = semanaDeLaVispera(allWeeks, activeWeek);
    if (!vispera) {
      await alert('No hay en el planning una semana anterior cuyo lunes sea la víspera de esta.', { type: 'info' });
      return;
    }
    const seguir = await confirm(`Se cerrará este editor y se abrirá el de la ${vispera.semana.name || 'semana anterior'}. Lo que no hayas guardado aquí se perderá. ¿Seguir?`, { type: 'warning' });
    if (!seguir) return;
    setIsTaskEditorModalOpen(false);
    setActiveWeekId(vispera.clave);
    setTimeout(() => setIsTaskEditorModalOpen(true), 0);
  };


  if (trabajadorActivo) {
    return (
      <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-3 sm:p-6 md:p-8 font-sans selection:bg-amber-500 selection:text-slate-950 relative">
        <BackgroundAnimation viewMode="worker" />
        <WorkerView
          workerName={trabajadorActivo}
          workersList={workersList}
          activeWeekData={activeWeek}
          clockEntries={currentWeekClockEntries}
          fichajesDeTodo={activeClockEntries}
          isAdmin={isAdmin}
          onToggleTask={(dayKey, taskIdx, weekId) => toggleTask(dayKey, taskIdx, weekId)}
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
  if (isPublicPreviewMode && !trabajadorActivo) {
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
            clockEntries={currentWeekClockEntries}
            semanas={allWeeks}
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
          initialWorkerName={trabajadorActivo}
          clockEntries={currentWeekClockEntries}
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
          {avisoAcceso && (
            <div role="status" className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <span>{avisoAcceso}</span>
            </div>
          )}
          <PublicView
            data={activeWeek}
            workersList={workersList}
            clockEntries={currentWeekClockEntries}
            semanas={allWeeks}
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
          initialWorkerName={trabajadorActivo}
          clockEntries={currentWeekClockEntries}
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
      <Suspense fallback={<CargandoPanel />}>
      <PartnerDashboardView
        activeWeekData={activeWeek}
        allWeeks={allWeeks}
        aprendizaje={aprendizaje}
        deshacerIa={deshacerIa}
        cambiadaTrasIa={cambiadaTrasIa()}
        onDeshacerIa={deshacerUltimaIa}
        onOlvidarDeshacerIa={olvidarDeshacerIa}
        activeWeekId={activeWeekId}
        onSelectWeek={setActiveWeekId}
        onUpdateWeek={handleUpdateActiveWeek}
        onRegenerateDraft={regenerarBorrador}
        onEliminarSemana={eliminarSemana}
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
        onOpenGemini={() => setIsGeminiModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenAddWeek={() => setIsWeekModalOpen(true)}
        onTogglePublicView={() => setIsPublicPreviewMode(true)}
        onToggleTask={(dayKey, taskIdx, weekId) => toggleTask(dayKey, taskIdx, weekId)}
        onUpdateClockEntry={handleUpdateClockEntry}
        onDeleteClockEntry={handleDeleteClockEntry}
        onRestoreClockEntry={handleRestoreClockEntry}
        deletedClockEntries={deletedClockEntries}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <ClockInModal
        isOpen={isClockInModalOpen}
        onClose={() => setIsClockInModalOpen(false)}
        workersList={workersList}
        initialWorkerName={trabajadorActivo}
        clockEntries={currentWeekClockEntries}
        onClockEntryCreated={handleClockEntryCreated}
      />

      <WeekManagerModal
        isOpen={isWeekModalOpen}
        onClose={() => setIsWeekModalOpen(false)}
        onCreateWeek={handleCreateWeek}
        onForceAutoDraft={() => ejecutarAnticipacion(true)}
        currentWeekName={activeWeek.name}
        currentWeekTrucks={activeWeek.trucks || []}
        workersList={workersList}
        aprendizaje={aprendizaje}
      />

      <GeminiAssistantModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        onApplyGeneratedSchedule={handleApplyGeminiSchedule}
        activeWeekData={activeWeek}
        workersList={workersList}
        aprendizaje={aprendizaje}
      />

      <EnlacesWhatsAppModal
        abierto={isShareModalOpen}
        onCerrar={() => setIsShareModalOpen(false)}
        workersList={workersList}
        admin={isAdmin}
      />

      <AdminWorkerEditorModal
        isOpen={isWorkerEditorModalOpen}
        onClose={() => setIsWorkerEditorModalOpen(false)}
        workersList={workersList}
        onAddWorker={handleAddWorker}
        onRemoveWorker={handleRemoveWorker}
        onUpdateWorker={handleUpdateWorker}
      />

      <AdminTaskEditorModal
        isOpen={isTaskEditorModalOpen}
        onClose={() => setIsTaskEditorModalOpen(false)}
        activeWeekData={activeWeek}
        workersList={workersList}
        onSaveWeekData={handleUpdateActiveWeek}
        onJumpToVispera={handleJumpToVispera}
      />
      </Suspense>

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
