import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Truck,
  Users,
  Clock,
  CheckCircle2,
  Circle,
  MapPin,
  Share2,
  Filter,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  Info,
  Maximize2,
  PartyPopper,
  Undo2,
  ClipboardList,
  PackageMinus,
  PackagePlus,
  PackageCheck
} from 'lucide-react';

// Categoriza una tarea por su texto para darle un icono/color propio en el
// grafo — pura ayuda visual para distinguir de un vistazo qué tipo de
// trabajo es (recogida, carga, descarga, prep, limpieza...), sin tocar
// el dato en sí. El orden importa: "descarga" contiene "carga" como
// substring, así que se comprueba primero.
const TASK_CATEGORY_RULES = [
  { test: (s) => s.includes('💒'), icon: PartyPopper, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-l-rose-500/70' },
  { test: (s) => /jornada eventos|catering|evento (suot|encamina)/i.test(s), icon: PartyPopper, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-l-pink-500/70' },
  { test: (s) => /limpieza|vajilla/i.test(s), icon: Sparkles, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-l-teal-500/70' },
  { test: (s) => /devoluci[oó]n/i.test(s), icon: Undo2, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-l-slate-500/70' },
  { test: (s) => /preparaci[oó]n|organizaci[oó]n|checklist/i.test(s), icon: ClipboardList, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-l-indigo-500/70' },
  { test: (s) => /descarga/i.test(s), icon: PackageMinus, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-l-orange-500/70' },
  { test: (s) => /\bcarga\b/i.test(s), icon: PackagePlus, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-500/70' },
  { test: (s) => /recog/i.test(s), icon: PackageCheck, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-l-cyan-500/70' }
];

const getTaskCategory = (label) => {
  const rule = TASK_CATEGORY_RULES.find((r) => r.test(label || ''));
  return rule || { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-slate-700' };
};

export default function TaskFlowGraphView({ activeWeekData, workersList = [], onToggleTask }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [filterDay, setFilterDay] = useState('all');
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'gantt'
  const [mobileColumn, setMobileColumn] = useState('all'); // 'all' | 'days' | 'tasks' | 'trucks' | 'workers'

  // Extract structured graph nodes & links from activeWeekData. Workers y
  // camiones se derivan SIEMPRE de los datos reales (workersList / trucks
  // de la semana activa) — antes eran listas fijas escritas a mano en este
  // componente, así que quitar/añadir a alguien del roster (o un camión)
  // no se reflejaba aquí: el grafo se quedaba enseñando gente que ya no
  // estaba asignada a nada (p.ej. Jaime, tras quitarlo del equipo).
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    // 1. Time / Day Nodes — título/badge reales de la semana activa cuando
    // existen, con el texto de siempre como respaldo si faltan.
    const dayFallback = {
      martes: { label: 'Martes 15', sub: 'Arranque Flota' },
      miercoles: { label: 'Miércoles 16', sub: 'Descarga Fincas' },
      jueves: { label: 'Jueves 17', sub: 'Eventos' },
      viernes: { label: 'Viernes 18', sub: 'Cierre Crítico' }
    };
    const days = [
      { id: 'day_martes', dayKey: 'martes', color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
      { id: 'day_miercoles', dayKey: 'miercoles', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-400' },
      { id: 'day_jueves', dayKey: 'jueves', color: 'border-purple-500 bg-purple-500/10 text-purple-400' },
      { id: 'day_viernes', dayKey: 'viernes', color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
      { id: 'day_sabado', dayKey: 'saturdaySpecial', label: activeWeekData?.saturdaySpecial?.title || 'Sábado 19', sub: '3 Bodas Simultáneas', color: 'border-rose-500 bg-rose-500/10 text-rose-400' },
      { id: 'day_domingo', dayKey: 'sundayMonday', label: activeWeekData?.sundayMonday?.title || 'Domingo 20 & Lunes 21', sub: 'Logística Inversa', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' }
    ].map(d => ({
      ...d,
      label: d.label || activeWeekData?.schedule?.[d.dayKey]?.title || dayFallback[d.dayKey]?.label || d.dayKey,
      sub: d.sub || activeWeekData?.schedule?.[d.dayKey]?.badge || dayFallback[d.dayKey]?.sub || ''
    }));

    days.forEach(d => {
      nodes.push({ id: d.id, type: 'day', label: d.label, sub: d.sub, dayKey: d.dayKey, color: d.color });
    });

    // 2. Trucks Nodes — de activeWeekData.trucks (Mongo), no de una lista fija.
    const truckColorByTag = (tag = '') => {
      if (/propio/i.test(tag)) return 'border-emerald-500 text-emerald-400 bg-emerald-500/10';
      if (/albacar/i.test(tag)) return 'border-purple-500 text-purple-400 bg-purple-500/10';
      return 'border-blue-500 text-blue-400 bg-blue-500/10';
    };
    const trucks = (activeWeekData?.trucks || []).map(t => ({
      id: `truck_${slug(t.name)}`,
      name: t.name,
      shortName: (t.name || '').replace(/^Cami[oó]n\s+/i, ''),
      tag: t.tag,
      color: truckColorByTag(t.tag)
    }));

    trucks.forEach(t => {
      nodes.push({ id: t.id, type: 'truck', label: t.name, sub: t.tag, color: t.color });
    });

    // 3. Worker Nodes — del roster real (workersList), no de una lista fija.
    const workers = workersList.map(w => ({ id: `worker_${slug(w.name)}`, name: w.name, role: w.role }));

    workers.forEach(w => {
      nodes.push({ id: w.id, type: 'worker', label: w.name, sub: w.role, color: 'border-slate-700 bg-slate-800 text-slate-200' });
    });

    // Worker links come from the task's own `assigned` array
    const workerIdByName = {};
    workers.forEach(w => { workerIdByName[normalize(w.name)] = w.id; });

    const linkAssignedWorkers = (taskId, assigned) => {
      (Array.isArray(assigned) ? assigned : []).forEach(name => {
        const workerId = workerIdByName[normalize(name)];
        if (workerId) links.push({ source: taskId, target: workerId });
      });
    };

    const truckIdByText = (text) => {
      const found = trucks.find(t => text.includes(t.name) || (t.shortName && text.includes(t.shortName)));
      return found ? found.id : null;
    };

    const linkTruck = (taskId, truckField, text) => {
      if (truckField) {
        const truckId = truckIdByText(truckField);
        if (truckId) links.push({ source: taskId, target: truckId });
        return;
      }
      if (/\d+\s*camiones/i.test(text)) {
        trucks.forEach(t => links.push({ source: taskId, target: t.id }));
        return;
      }
      const truckId = truckIdByText(text);
      if (truckId) links.push({ source: taskId, target: truckId });
    };

    // 4. Task Nodes & Links
    const rawSchedule = activeWeekData?.schedule || {};

    const dayConfigs = [
      { dayId: 'day_martes', dayKey: 'martes' },
      { dayId: 'day_miercoles', dayKey: 'miercoles' },
      { dayId: 'day_jueves', dayKey: 'jueves' },
      { dayId: 'day_viernes', dayKey: 'viernes' }
    ];

    dayConfigs.forEach(({ dayId, dayKey }) => {
      const dayTasks = rawSchedule[dayKey]?.tasks || [];
      dayTasks.forEach((tItem, idx) => {
        const id = `task_${dayKey}_${idx}`;
        const textStr = typeof tItem === 'object' ? tItem.text : tItem;
        const completed = typeof tItem === 'object' ? !!tItem.completed : false;
        const assigned = typeof tItem === 'object' ? tItem.assigned : [];
        const truck = typeof tItem === 'object' ? tItem.truck : null;
        const timeFrame = typeof tItem === 'object' ? tItem.timeFrame : null;
        nodes.push({ id, type: 'task', label: textStr, timeFrame, completed, dayId, dayKey, idx });
        links.push({ source: dayId, target: id });

        linkTruck(id, truck, textStr);
        linkAssignedWorkers(id, assigned);
      });
    });

    // Sábado 3 Bodas
    const weddings = activeWeekData?.saturdaySpecial?.weddings || [];

    weddings.forEach((w, idx) => {
      const id = `task_sabado_${idx}`;
      nodes.push({ id, type: 'task', label: `💒 ${w.location}`, sub: w.details, timeFrame: w.timeFrame, dayId: 'day_sabado', dayKey: 'saturdaySpecial', idx });
      links.push({ source: 'day_sabado', target: id });

      if (w.truck) {
        const truckId = truckIdByText(w.truck);
        if (truckId) links.push({ source: id, target: truckId });
      }

      linkAssignedWorkers(id, w.assigned);
    });

    // Domingo & Lunes tasks
    const domTasks = activeWeekData?.sundayMonday?.tasks || [];

    domTasks.forEach((tItem, idx) => {
      const id = `task_domingo_${idx}`;
      const textStr = typeof tItem === 'object' ? tItem.text : tItem;
      const assigned = typeof tItem === 'object' ? tItem.assigned : [];
      const truck = typeof tItem === 'object' ? tItem.truck : null;
      const timeFrame = typeof tItem === 'object' ? tItem.timeFrame : null;
      nodes.push({ id, type: 'task', label: textStr, timeFrame, dayId: 'day_domingo', dayKey: 'sundayMonday', idx });
      links.push({ source: 'day_domingo', target: id });

      linkTruck(id, truck, textStr);
      linkAssignedWorkers(id, assigned);
    });

    return { nodes, links };
  }, [activeWeekData, workersList]);

  // Connected node IDs calculation when a node is hovered/clicked.
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set();
    const nodeTypeById = new Map(graphData.nodes.map(n => [n.id, n.type]));
    const set = new Set([selectedNodeId]);
    let frontier = [selectedNodeId];
    const maxHops = 2;

    for (let hop = 0; hop < maxHops; hop++) {
      const next = [];
      frontier.forEach(id => {
        if (hop > 0 && nodeTypeById.get(id) !== 'task') return;
        graphData.links.forEach(l => {
          if (l.source === id && !set.has(l.target)) { set.add(l.target); next.push(l.target); }
          if (l.target === id && !set.has(l.source)) { set.add(l.source); next.push(l.source); }
        });
      });
      frontier = next;
    }

    return set;
  }, [selectedNodeId, graphData]);

  // Selected node object
  const selectedNodeObj = graphData.nodes.find(n => n.id === selectedNodeId);

  // Connected route details for interactive banner
  const connectedRouteDetails = useMemo(() => {
    if (!selectedNodeId || !selectedNodeObj) return null;
    const connectedTasks = graphData.nodes.filter(n => n.type === 'task' && connectedNodeIds.has(n.id));
    const connectedDays = graphData.nodes.filter(n => n.type === 'day' && connectedNodeIds.has(n.id));
    const connectedTrucks = graphData.nodes.filter(n => n.type === 'truck' && connectedNodeIds.has(n.id));
    const connectedWorkers = graphData.nodes.filter(n => n.type === 'worker' && connectedNodeIds.has(n.id));
    return {
      connectedTasks,
      connectedDays,
      connectedTrucks,
      connectedWorkers
    };
  }, [selectedNodeId, selectedNodeObj, graphData, connectedNodeIds]);

  // Filtered nodes
  const dayNodes = graphData.nodes.filter(n => n.type === 'day');
  
  const taskNodes = graphData.nodes.filter(n => {
    if (n.type !== 'task') return false;
    if (filterDay !== 'all' && n.dayId !== filterDay) return false;
    if (filterTruck !== 'all') {
      const connectsTruck = graphData.links.some(l => 
        (l.source === n.id && l.target === filterTruck) || (l.target === n.id && l.source === filterTruck)
      );
      if (!connectsTruck) return false;
    }
    if (filterWorker !== 'all') {
      const connectsWorker = graphData.links.some(l => 
        (l.source === n.id && l.target === filterWorker) || (l.target === n.id && l.source === filterWorker)
      );
      if (!connectsWorker) return false;
    }
    return true;
  });

  const truckNodes = graphData.nodes.filter(n => n.type === 'truck');
  const workerNodes = graphData.nodes.filter(n => n.type === 'worker');

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn w-full max-w-full">
      {/* Top Header & Interactive Mode Selectors */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4 bg-slate-900/90 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg shrink-0">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-xl font-black font-['Outfit'] text-white">
                Grafo Interactivo de Tareas & Flujo
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase shrink-0 leading-tight">
                Visual Flow
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-2 sm:line-clamp-none">
              Relaciones entre Días, Tareas, Camiones y Personal. Toca cualquier elemento para ver su ruta completa.
            </p>
          </div>
        </div>

        {/* Filters & View Toggles */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 sm:flex-none">
            {/* Day Filter */}
            <select 
              value={filterDay} 
              onChange={(e) => setFilterDay(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none w-full"
            >
              <option value="all">📅 Todos los Días</option>
              <option value="day_martes">Martes 15</option>
              <option value="day_miercoles">Miércoles 16</option>
              <option value="day_jueves">Jueves 17</option>
              <option value="day_viernes">Viernes 18</option>
              <option value="day_sabado">Sábado 19 (Bodas)</option>
              <option value="day_domingo">Domingo 20</option>
            </select>

            {/* Truck Filter */}
            <select 
              value={filterTruck} 
              onChange={(e) => setFilterTruck(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none w-full"
            >
              <option value="all">🚚 Toda la Flota</option>
              {truckNodes.map(t => (
                <option key={t.id} value={t.id}>{t.label}{t.sub ? ` (${t.sub})` : ''}</option>
              ))}
            </select>

            {/* Worker Filter — del roster real (workerNodes), no una lista fija */}
            <select
              value={filterWorker}
              onChange={(e) => setFilterWorker(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none w-full"
            >
              <option value="all">👥 Todo el Equipo</option>
              {workerNodes.map(w => (
                <option key={w.id} value={w.id}>{w.label}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0 justify-center">
            <button
              onClick={() => setViewMode('graph')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                viewMode === 'graph' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🕸️ Grafo
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                viewMode === 'gantt' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              📊 Gantt
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Node Graph Area */}
      {viewMode === 'graph' ? (
        <div className="relative bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl min-h-[480px]">
          {/* Subtle Grid Canvas Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none rounded-2xl sm:rounded-3xl" />

          {/* Mobile Column Selector Bar */}
          <div className="relative z-20 flex md:hidden items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3">
            <button
              onClick={() => setMobileColumn('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                mobileColumn === 'all'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              🌐 Vista Completa
            </button>
            <button
              onClick={() => setMobileColumn('days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                mobileColumn === 'days'
                  ? 'bg-blue-500 text-white border-blue-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              📅 Días ({dayNodes.length})
            </button>
            <button
              onClick={() => setMobileColumn('tasks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                mobileColumn === 'tasks'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              📋 Tareas ({taskNodes.length})
            </button>
            <button
              onClick={() => setMobileColumn('trucks')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                mobileColumn === 'trucks'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              🚚 Camiones ({truckNodes.length})
            </button>
            <button
              onClick={() => setMobileColumn('workers')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                mobileColumn === 'workers'
                  ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              👥 Personal ({workerNodes.length})
            </button>
          </div>

          {/* Active selection banner & Interactive Connected Route Card */}
          {selectedNodeObj && (
            <div className="relative z-20 mb-4 sm:mb-6 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/40 p-3.5 sm:p-5 rounded-2xl shadow-xl space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2.5">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider">
                        Ruta Conectada • Nodo Activo
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 capitalize">
                        {selectedNodeObj.type}
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-extrabold text-white truncate font-['Outfit'] mt-0.5">
                      {selectedNodeObj.label}
                    </h4>
                    {selectedNodeObj.sub && <p className="text-[11px] text-amber-200/80">{selectedNodeObj.sub}</p>}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNodeId(null)}
                  className="text-xs bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 active:scale-95"
                >
                  Desmarcar
                </button>
              </div>

              {/* Connected Route Badges: Days, Trucks, Team */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {connectedRouteDetails?.connectedDays.length > 0 && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-blue-400 block mb-1">📅 Días Involucrados</span>
                    <div className="flex flex-wrap gap-1">
                      {connectedRouteDetails.connectedDays.map(d => (
                        <span key={d.id} className="text-[11px] font-semibold text-slate-200 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {connectedRouteDetails?.connectedTrucks.length > 0 && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-1">🚚 Flota Asignada</span>
                    <div className="flex flex-wrap gap-1">
                      {connectedRouteDetails.connectedTrucks.map(tr => (
                        <span key={tr.id} className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {tr.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {connectedRouteDetails?.connectedWorkers.length > 0 && (
                  <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-purple-400 block mb-1">👥 Personal en Ruta</span>
                    <div className="flex flex-wrap gap-1">
                      {connectedRouteDetails.connectedWorkers.map(w => (
                        <span key={w.id} className="text-[11px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                          {w.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Connected Tasks list if selecting day, truck or worker */}
              {selectedNodeObj.type !== 'task' && connectedRouteDetails?.connectedTasks.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-bold uppercase text-amber-400 block mb-1.5">
                    📋 Tareas en este Flujo ({connectedRouteDetails.connectedTasks.length})
                  </span>
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                    {connectedRouteDetails.connectedTasks.map(ct => (
                      <div key={ct.id} className="text-xs bg-slate-950/90 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                        <span className={`truncate ${ct.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                          {ct.timeFrame ? `${ct.timeFrame} • ` : ''}{ct.label}
                        </span>
                        {ct.completed && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
                            ✓ Hecho
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4 Interactive Columns Graph View - Fully responsive */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-full">
            
            {/* COLUMN 1: DÍAS / HITOS */}
            <div className={`space-y-3 ${mobileColumn !== 'all' && mobileColumn !== 'days' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-blue-400 tracking-wider pb-2 border-b border-slate-800">
                <Calendar className="w-4 h-4" />
                <span>1. Días & Hitos</span>
              </div>

              <div className="space-y-2">
                {dayNodes.map(d => {
                  const isSelected = selectedNodeId === d.id;
                  const isConnected = connectedNodeIds.has(d.id);
                  const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedNodeId(isSelected ? null : d.id)}
                      className={`cursor-pointer transition-all duration-300 p-3 sm:p-3.5 rounded-2xl border ${d.color} ${opacityClass} ${
                        isSelected ? 'ring-2 ring-amber-400 scale-[1.02] shadow-lg shadow-amber-500/20' : 'hover:scale-[1.01]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-xs">{d.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/60 text-slate-300 border border-slate-700/50">
                          {d.sub}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: TAREAS & ACTIVIDADES */}
            <div className={`space-y-3 md:col-span-1 ${mobileColumn !== 'all' && mobileColumn !== 'tasks' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-amber-400 tracking-wider pb-2 border-b border-slate-800">
                <Clock className="w-4 h-4" />
                <span>2. Tareas & Operaciones ({taskNodes.length})</span>
              </div>

              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {taskNodes.map(t => {
                  const isSelected = selectedNodeId === t.id;
                  const isConnected = connectedNodeIds.has(t.id);
                  const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';
                  const category = getTaskCategory(t.label);
                  const CategoryIcon = category.icon;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedNodeId(isSelected ? null : t.id)}
                      className={`cursor-pointer transition-all duration-300 p-3 rounded-2xl border border-l-4 bg-slate-900/80 border-slate-800 ${category.border} ${opacityClass} ${
                        isSelected ? 'border-amber-400 ring-2 ring-amber-400 scale-[1.02] shadow-xl shadow-amber-500/20' : 'hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {t.dayKey && onToggleTask ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(t.dayKey, t.idx);
                            }}
                            className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
                          >
                            {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                          </button>
                        ) : (
                          <CategoryIcon className={`w-4 h-4 ${category.color} mt-0.5 shrink-0`} />
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 ${category.bg} ${category.color}`}>
                              <CategoryIcon className="w-3 h-3" />
                            </span>
                            {t.timeFrame && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded-md">
                                <Clock className="w-3 h-3" />
                                {t.timeFrame}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs font-medium leading-snug ${t.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {t.label}
                          </p>
                          {t.sub && <p className="text-[11px] text-amber-400/90 font-semibold mt-1">{t.sub}</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: FLOTA & CAMIONES */}
            <div className={`space-y-3 ${mobileColumn !== 'all' && mobileColumn !== 'trucks' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-emerald-400 tracking-wider pb-2 border-b border-slate-800">
                <Truck className="w-4 h-4" />
                <span>3. Flota de Camiones</span>
              </div>

              <div className="space-y-2">
                {truckNodes.map(tr => {
                  const isSelected = selectedNodeId === tr.id;
                  const isConnected = connectedNodeIds.has(tr.id);
                  const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                  return (
                    <div
                      key={tr.id}
                      onClick={() => setSelectedNodeId(isSelected ? null : tr.id)}
                      className={`cursor-pointer transition-all duration-300 p-3 sm:p-3.5 rounded-2xl border ${tr.color} ${opacityClass} ${
                        isSelected ? 'ring-2 ring-emerald-400 scale-[1.02] shadow-lg shadow-emerald-500/20' : 'hover:scale-[1.01]'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Truck className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-xs truncate">{tr.label}</h4>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{tr.sub}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 4: TRABAJADORES & ROLES */}
            <div className={`space-y-3 ${mobileColumn !== 'all' && mobileColumn !== 'workers' ? 'hidden md:block' : 'block'}`}>
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-purple-400 tracking-wider pb-2 border-b border-slate-800">
                <Users className="w-4 h-4" />
                <span>4. Personal Asignado</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[560px] overflow-y-auto pr-1">
                {workerNodes.map(w => {
                  const isSelected = selectedNodeId === w.id;
                  const isConnected = connectedNodeIds.has(w.id);
                  const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                  return (
                    <div
                      key={w.id}
                      onClick={() => setSelectedNodeId(isSelected ? null : w.id)}
                      className={`cursor-pointer transition-all duration-300 p-2.5 rounded-xl border bg-slate-900/90 border-slate-800 text-slate-300 ${opacityClass} ${
                        isSelected ? 'border-purple-400 ring-2 ring-purple-400 scale-[1.02] shadow-lg shadow-purple-500/20 text-white' : 'hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{w.label}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                          {w.sub}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* GANTT TIMELINE VIEW */
        <div className="bg-slate-950 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-slate-800">
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Cronograma Gantt Operativo de la Semana</span>
            </h3>
            <span className="text-xs text-slate-400">Progreso por jornadas completadas</span>
          </div>

          <div className="space-y-4">
            {dayNodes.map(d => {
              const dayTasks = taskNodes.filter(t => t.dayId === d.id);
              const completedCount = dayTasks.filter(t => t.completed).length;
              const totalCount = dayTasks.length;
              const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div key={d.id} className="bg-slate-900/80 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-extrabold text-xs sm:text-sm text-amber-400 truncate">{d.label}</span>
                      <span className="text-xs text-slate-400">({d.sub})</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-bold shrink-0">
                      {completedCount} / {totalCount} Tareas ({pct}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 sm:h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Tasks List snippet */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {dayTasks.map(t => {
                      const category = getTaskCategory(t.label);
                      const CategoryIcon = category.icon;
                      return (
                        <div key={t.id} className={`text-xs bg-slate-950 p-2.5 rounded-xl border border-l-4 border-slate-800/80 ${category.border} text-slate-300 flex items-start space-x-2`}>
                          <CategoryIcon className={`w-3.5 h-3.5 ${category.color} mt-0.5 shrink-0`} />
                          <span className={t.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                            {t.timeFrame && <span className="text-blue-300 font-bold">{t.timeFrame} — </span>}
                            {t.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
