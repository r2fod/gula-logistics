import React, { useState, useEffect, useMemo } from 'react';
import { initialBalancesData } from '../data/balancesData';
import { fetchBalancesFromAPI, saveWorkerBalanceToAPI } from '../data/apiService';
import { pairShiftsFromEntries, aggregateShiftsByWorker } from '../data/shiftCalculations';
import { fusionarSaldosConEquipo, buscarPorNombreDeSaldo } from '../data/saldosEquipo';
import { enlaceSocias } from '../data/enlaces';
import { esBorrador } from '../data/anticipacion';
import { tareasDeLaVispera, fichadosDelDia } from '../data/vispera';
import { useCopiado } from '../hooks/useCopiado';
import { useAvisarCambios } from '../hooks/useAvisarCambios';
import { useDialog } from '../contexts/DialogContext';
import TeamBalancesTab from './dashboard/TeamBalancesTab';
import FinancialSummaryTab from './dashboard/FinancialSummaryTab';
import LogisticsTab from './dashboard/LogisticsTab';
import ScheduleTab from './dashboard/ScheduleTab';
import FichajesTab from './dashboard/FichajesTab';
import LiveMonitorPanel from './LiveMonitorPanel';
import AdminClockEditModal from './AdminClockEditModal';
import TaskFlowGraphView from './TaskFlowGraphView';
import AdminSettingsModal from './AdminSettingsModal';
import AdminAiMemoryModal from './AdminAiMemoryModal';
import SemanaBorradorBanner from './SemanaBorradorBanner';
import CabeceraPanel from './panel/CabeceraPanel';
import MenuLateral from './panel/MenuLateral';
import { BarraPestanas, BarraInferior } from './panel/NavegacionPrincipal';
import AvisarCambiosModal from './panel/AvisarCambiosModal';
import { crearAcciones } from './panel/acciones';
import { pestanaDesdeUrl, guardarPestanaEnUrl } from './panel/pestanas';

// Panel de control de la dirección: cabecera con acciones, pestañas y los
// modales que se abren desde ellas. Aquí solo vive el estado compartido (pestaña,
// saldos, sesión de admin); cada pieza visible está en `panel/` o `dashboard/`.
export default function PartnerDashboardView({
  activeWeekData,
  allWeeks = {},
  activeWeekId,
  onSelectWeek,
  onRegenerateDraft,
  onEliminarSemana,
  anticipacionAviso,
  onCerrarAnticipacionAviso,

  onUpdateWeek,
  workersList = [],
  clockEntries = [],
  isAdmin = false,
  balancesData: externalBalancesData,
  setBalancesData: externalSetBalancesData,
  onLogoutAdmin,
  onOpenAdminLogin,
  onOpenClockIn,
  onOpenPayroll,
  onOpenGemini,
  onOpenShareModal,
  onOpenAddWeek,
  onTogglePublicView,
  onUpdateClockEntry,
  onDeleteClockEntry,
  onClockEntryCreated,
  onOpenWorkerEditor,
  onOpenTaskEditor,
  onToggleTask
}) {
  const { alert, confirm } = useDialog();
  const [activeTab, setActiveTab] = useState(() => pestanaDesdeUrl(window.location.search));
  const [adminUnlocked, setAdminUnlocked] = useState(isAdmin);
  const [isAdminEditOpen, setIsAdminEditOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [internalBalancesData, setInternalBalancesData] = useState(externalBalancesData || initialBalancesData);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [isAdminAiMemoryOpen, setIsAdminAiMemoryOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [enlaceCopiado, copiarEnlace] = useCopiado();
  const aviso = useAvisarCambios();

  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    guardarPestanaEnUrl(tabKey);
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

  const balancesData = externalBalancesData || internalBalancesData || { workers: [] };
  const mergedBalancesData = fusionarSaldosConEquipo(balancesData, workersList);

  // Actualiza un trabajador dentro de balancesData (en pantalla al instante)
  // y lo guarda en MongoDB vía PUT /api/balances/:id. Solo admin (los
  // botones que llaman a esto están ocultos si !adminUnlocked).
  const persistWorkerBalance = async (workerId, updatedFields) => {
    const currentWorkers = balancesData.workers || [];
    const newWorkers = currentWorkers.map(w => w.id === workerId ? { ...w, ...updatedFields } : w);
    const newBalancesData = { ...balancesData, workers: newWorkers };
    setInternalBalancesData(newBalancesData);
    if (externalSetBalancesData) externalSetBalancesData(newBalancesData);

    // El estado "guardando..." (savingBalanceId) ya lo gestiona el propio
    // TeamBalancesTab.jsx alrededor de cada llamada a esta función — no
    // duplicarlo aquí (esta función no tiene ese estado, y llamarlo
    // rompía el guardado de cualquier cambio con un ReferenceError).
    const saved = await saveWorkerBalanceToAPI(workerId, updatedFields);
    if (!saved) {
      // El cambio ya se ve en pantalla (arriba, optimista) pero NO llegó a
      // Mongo — sin este aviso, desaparecía solo en el siguiente refresco
      // sin que nadie supiera por qué.
      await alert('⚠️ No se pudo guardar este cambio de saldo en el servidor (posible sesión de administrador caducada o sin conexión). Se ve aquí pero puede desaparecer solo en unos segundos — vuelve a iniciar sesión de Admin y repite el cambio.', { type: 'warning' });
    }
  };

  const handleSalir = () => {
    if (onLogoutAdmin) onLogoutAdmin();
    setAdminUnlocked(false);
  };

  const handleDesbloquear = () => {
    if (onOpenAdminLogin) onOpenAdminLogin();
  };

  const handleOpenEditEntry = (entry) => {
    setEditingEntry(entry);
    setIsAdminEditOpen(true);
  };

  const handleOpenCreateEntry = () => {
    setEditingEntry(null);
    setIsAdminEditOpen(true);
  };

  // Emparejar y agregar los fichajes es caro: memoizado por clockEntries/workersList
  // para no repetirlo al cambiar de pestaña o abrir un modal sin fichajes nuevos.
  // Los totales y el desglose por evento del Resumen Financiero los calcula su
  // pestaña, porque dependen del periodo elegido (semana, mes, año o todo).
  const { shifts: paidShifts } = useMemo(() => pairShiftsFromEntries(clockEntries), [clockEntries]);
  const workerBalances = useMemo(() => aggregateShiftsByWorker(paidShifts, workersList), [paidShifts, workersList]);

  // Horas y turnos de quien tiene la ficha `nombreSaldo` ("Marta Gula"); los
  // fichajes están indexados por el nombre corto del equipo ("Marta").
  const findWorkerHours = (nombreSaldo) => buscarPorNombreDeSaldo(workerBalances, nombreSaldo);

  // El lunes anterior a la semana abierta: sus tareas y quién fichó ese día.
  const vispera = useMemo(() => {
    const v = tareasDeLaVispera(allWeeks, activeWeekData);
    return v ? { ...v, fichados: fichadosDelDia(paidShifts, v.fecha) } : null;
  }, [allWeeks, activeWeekData, paidShifts]);

  const actualizarSemana = (weekId, partialUpdate) => {
    if (onUpdateWeek) onUpdateWeek({ ...activeWeekData, ...partialUpdate });
  };

  const acciones = crearAcciones(
    { admin: adminUnlocked, avisando: aviso.enviando, enlaceSociasCopiado: !!enlaceCopiado },
    {
      fichar: onOpenClockIn,
      avisar: aviso.abrir,
      editarPlanning: onOpenTaskEditor,
      editarEquipo: onOpenWorkerEditor,
      nominas: onOpenPayroll,
      gemini: onOpenGemini,
      compartir: onOpenShareModal,
      copiarEnlaceSocias: () => copiarEnlace(enlaceSocias()),
      vistaPublica: onTogglePublicView && (() => onTogglePublicView(false)),
      claves: () => setIsAdminSettingsOpen(true),
      memoriaIa: () => setIsAdminAiMemoryOpen(true),
      nuevaSemana: onOpenAddWeek,
      generarBorrador: onRegenerateDraft ? () => onRegenerateDraft(activeWeekId) : undefined,
    }
  );

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100 antialiased p-2.5 sm:p-4 md:p-5 font-sans space-y-3 w-full max-w-full overflow-x-hidden pb-32 lg:pb-16">
      <CabeceraPanel
        adminUnlocked={adminUnlocked}
        activeWeekData={activeWeekData}
        allWeeks={allWeeks}
        activeWeekId={activeWeekId}
        onSelectWeek={onSelectWeek}
        acciones={acciones}
        onSalir={handleSalir}
        onDesbloquear={handleDesbloquear}
        onAbrirMenu={() => setIsMobileDrawerOpen(true)}
      />

      {/* Aviso de borradores recién preparados desde el calendario */}
      {adminUnlocked && anticipacionAviso && (
        <div role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-[11px] sm:text-xs text-emerald-200 flex items-start justify-between gap-3">
          <span>{anticipacionAviso}</span>
          <button type="button" onClick={onCerrarAnticipacionAviso} aria-label="Cerrar aviso" className="shrink-0 text-emerald-300 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* Semana en BORRADOR: propuesta generada desde el calendario, pendiente de revisar y aceptar */}
      {esBorrador(activeWeekData) && (
        <SemanaBorradorBanner
          week={activeWeekData}
          adminUnlocked={adminUnlocked}
          onAceptar={async () => {
            if (!(await confirm('¿Aceptar esta semana y activarla? Dejará de ser un borrador.', { type: 'warning' }))) return;
            const { avisos, ...metaSinAvisos } = activeWeekData.meta || {};
            if (onUpdateWeek) onUpdateWeek({ ...activeWeekData, meta: { ...metaSinAvisos, status: 'Operativa Activa', aceptadaEl: new Date().toISOString() } });
          }}
          onRegenerar={onRegenerateDraft ? () => onRegenerateDraft(activeWeekId) : undefined}
          onEliminar={onEliminarSemana ? () => onEliminarSemana(activeWeekId) : undefined}
        />
      )}

      <BarraPestanas activa={activeTab} onSeleccionar={handleTabClick} contadorFichajes={clockEntries.length} />

      {activeTab === 'balances' && (
        <TeamBalancesTab
          balancesData={mergedBalancesData}
          onOpenShareModal={onOpenShareModal}
          adminUnlocked={adminUnlocked}
          onDeleteClockEntry={onDeleteClockEntry}
          persistWorkerBalance={persistWorkerBalance}
          findWorkerHours={findWorkerHours}
        />
      )}

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

      {activeTab === 'financial' && (
        <FinancialSummaryTab
          shifts={paidShifts}
          workersList={workersList}
          allWeeks={allWeeks}
          activeWeekData={activeWeekData}
        />
      )}

      {activeTab === 'logistics' && (
        <LogisticsTab
          activeWeekData={activeWeekData}
          adminUnlocked={adminUnlocked}
          onUpdateWeek={actualizarSemana}
        />
      )}

      {activeTab === 'schedule' && (
        <ScheduleTab
          activeWeekData={activeWeekData}
          workersList={workersList}
          onToggleTask={onToggleTask}
          onUpdateWeek={actualizarSemana}
          vispera={vispera}
        />
      )}

      {activeTab === 'graph' && (
        <TaskFlowGraphView activeWeekData={activeWeekData} workersList={workersList} />
      )}

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

      <AdminAiMemoryModal
        isOpen={isAdminAiMemoryOpen}
        onClose={() => setIsAdminAiMemoryOpen(false)}
      />

      <MenuLateral
        abierto={isMobileDrawerOpen}
        onCerrar={() => setIsMobileDrawerOpen(false)}
        acciones={acciones}
        adminUnlocked={adminUnlocked}
        onSalir={handleSalir}
        onDesbloquear={handleDesbloquear}
      />

      <BarraInferior activa={activeTab} onSeleccionar={handleTabClick} onAbrirMenu={() => setIsMobileDrawerOpen(true)} />

      <AvisarCambiosModal
        abierto={aviso.abierto}
        onCerrar={aviso.cerrar}
        workersList={workersList}
        enviando={aviso.enviando}
        onEnviar={aviso.enviar}
      />
    </div>
  );
}
