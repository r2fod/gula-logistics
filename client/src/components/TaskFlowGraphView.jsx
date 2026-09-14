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
  Maximize2
} from 'lucide-react';

export default function TaskFlowGraphView({ activeWeekData, onToggleTask }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [filterDay, setFilterDay] = useState('all');
  const [filterTruck, setFilterTruck] = useState('all');
  const [filterWorker, setFilterWorker] = useState('all');
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'gantt'

  // Extract structured graph nodes & links from activeWeekData or fallback defaults
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    // 1. Time / Day Nodes
    const days = [
      { id: 'day_martes', label: 'Martes 15', sub: 'Arranque Flota', dayKey: 'martes', color: 'border-blue-500 bg-blue-500/10 text-blue-400' },
      { id: 'day_miercoles', label: 'Miércoles 16', sub: 'Descarga Fincas', dayKey: 'miercoles', color: 'border-cyan-500 bg-cyan-500/10 text-cyan-400' },
      { id: 'day_jueves', label: 'Jueves 17', sub: 'Eventos', dayKey: 'jueves', color: 'border-purple-500 bg-purple-500/10 text-purple-400' },
      { id: 'day_viernes', label: 'Viernes 18', sub: 'Cierre Crítico', dayKey: 'viernes', color: 'border-amber-500 bg-amber-500/10 text-amber-400' },
      { id: 'day_sabado', label: 'Sábado 19', sub: '3 Bodas Simultáneas', dayKey: 'saturdaySpecial', color: 'border-rose-500 bg-rose-500/10 text-rose-400' },
      { id: 'day_domingo', label: 'Domingo 20 & Lunes 21', sub: 'Logística Inversa', dayKey: 'sundayMonday', color: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' }
    ];

    days.forEach(d => {
      nodes.push({ id: d.id, type: 'day', label: d.label, sub: d.sub, dayKey: d.dayKey, color: d.color });
    });

    // 2. Trucks Nodes
    const trucks = [
      { id: 'truck_gula', name: 'Camión Gula', tag: 'PROPIO GULA', color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
      { id: 'truck_covey', name: 'Camión Covey', tag: 'ALQUILER COVEY', color: 'border-blue-500 text-blue-400 bg-blue-500/10' },
      { id: 'truck_albacar', name: 'Camión Albacar', tag: 'ALQUILER ALBACAR', color: 'border-purple-500 text-purple-400 bg-purple-500/10' }
    ];

    trucks.forEach(t => {
      nodes.push({ id: t.id, type: 'truck', label: t.name, sub: t.tag, color: t.color });
    });

    // 3. Worker Nodes
    const workers = [
      { id: 'worker_gonzalo', name: 'Gonzalo', role: 'Conductor' },
      { id: 'worker_ricardo', name: 'Ricardo', role: 'Conductor' },
      { id: 'worker_jaime', name: 'Jaime', role: 'Conductor' },
      { id: 'worker_johan', name: 'Johan', role: 'Backup/Conductor' },
      { id: 'worker_jeferson', name: 'Jeferson', role: 'Apoyo Base' },
      { id: 'worker_irene', name: 'Irene', role: 'Checklist/Base' },
      { id: 'worker_kerly', name: 'Kerly', role: 'Limpieza' },
      { id: 'worker_jose', name: 'Jose', role: 'Limpieza' },
      { id: 'worker_raul', name: 'Raúl', role: 'Jefe Logística' }
    ];

    workers.forEach(w => {
      nodes.push({ id: w.id, type: 'worker', label: w.name, sub: w.role, color: 'border-slate-700 bg-slate-800 text-slate-200' });
    });

    // Worker links come from the task's own `assigned` array (set by the
    // manual editor or Gemini AI) — not from scanning the text for a name,
    // which silently misses anyone not literally spelled out in the sentence.
    const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const workerIdByName = {};
    workers.forEach(w => { workerIdByName[normalize(w.name)] = w.id; });

    const linkAssignedWorkers = (taskId, assigned) => {
      (Array.isArray(assigned) ? assigned : []).forEach(name => {
        const workerId = workerIdByName[normalize(name)];
        if (workerId) links.push({ source: taskId, target: workerId });
      });
    };

    const truckIdByText = (text) => {
      if (text.includes('Covey')) return 'truck_covey';
      if (text.includes('Albacar')) return 'truck_albacar';
      if (text.includes('Gula')) return 'truck_gula';
      return null;
    };

    // Prefer the task's own `truck` field (set via the manual editor) over
    // scanning the text — a task can use a truck without naming it in the sentence.
    const linkTruck = (taskId, truckField, text) => {
      if (truckField) {
        const truckId = truckIdByText(truckField);
        if (truckId) links.push({ source: taskId, target: truckId });
        return;
      }
      if (text.includes('3 camiones')) {
        links.push({ source: taskId, target: 'truck_gula' });
        links.push({ source: taskId, target: 'truck_covey' });
        links.push({ source: taskId, target: 'truck_albacar' });
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
        nodes.push({ id, type: 'task', label: textStr, completed, dayId, dayKey, idx });
        links.push({ source: dayId, target: id });

        linkTruck(id, truck, textStr);
        linkAssignedWorkers(id, assigned);
      });
    });

    // Sábado 3 Bodas
    const weddings = activeWeekData?.saturdaySpecial?.weddings || [
      { location: "Sot de Chera (250 pax)", truck: "Camión Gula", details: "Ricardo + Jeferson", assigned: ["Ricardo", "Jeferson"] },
      { location: "Mas dels Refranys", truck: "Camión Covey", details: "Gonzalo + Johan", assigned: ["Gonzalo", "Johan"] },
      { location: "María y Joaquín", truck: "Camión Albacar", details: "Jaime + Johan/Jef", assigned: ["Jaime"] }
    ];

    weddings.forEach((w, idx) => {
      const id = `task_sabado_${idx}`;
      nodes.push({ id, type: 'task', label: `💒 ${w.location}`, sub: w.details, dayId: 'day_sabado', dayKey: 'saturdaySpecial', idx });
      links.push({ source: 'day_sabado', target: id });

      if (w.truck?.includes('Gula')) links.push({ source: id, target: 'truck_gula' });
      if (w.truck?.includes('Covey')) links.push({ source: id, target: 'truck_covey' });
      if (w.truck?.includes('Albacar')) links.push({ source: id, target: 'truck_albacar' });

      linkAssignedWorkers(id, w.assigned);
    });

    // Domingo & Lunes tasks
    const domTasks = activeWeekData?.sundayMonday?.tasks || [
      { text: "09:00 - 13:00: Descarga general de los 3 camiones en almacén. Limpieza de vajilla por Kerly y Jose", assigned: ["Kerly", "Jose"] },
      { text: "Devoluciones: Devolución de Camiones de Alquiler Albacar y Covey (Gonzalo/Ricardo). Ruta Dealde y 90 sillas a Carvillo", assigned: ["Gonzalo", "Ricardo"] }
    ];

    domTasks.forEach((tItem, idx) => {
      const id = `task_domingo_${idx}`;
      const textStr = typeof tItem === 'object' ? tItem.text : tItem;
      const assigned = typeof tItem === 'object' ? tItem.assigned : [];
      const truck = typeof tItem === 'object' ? tItem.truck : null;
      nodes.push({ id, type: 'task', label: textStr, dayId: 'day_domingo', dayKey: 'sundayMonday', idx });
      links.push({ source: 'day_domingo', target: id });

      linkTruck(id, truck, textStr);
      linkAssignedWorkers(id, assigned);
    });

    return { nodes, links };
  }, [activeWeekData]);

  // Connected node IDs calculation when a node is hovered/clicked
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return new Set();
    const set = new Set([selectedNodeId]);

    graphData.links.forEach(l => {
      if (l.source === selectedNodeId) set.add(l.target);
      if (l.target === selectedNodeId) set.add(l.source);
    });

    return set;
  }, [selectedNodeId, graphData]);

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

  const selectedNodeObj = graphData.nodes.find(n => n.id === selectedNodeId);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Interactive Mode Selectors */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-lg">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black font-['Outfit'] text-white flex items-center gap-2">
              <span>Grafo Interactivo de Tareas & Flujo Logístico</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold uppercase">
                Visual Flow
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Visualiza las relaciones y flujo entre Días, Tareas, Camiones y Trabajadores. Toca cualquier nodo para resaltar su ruta.
            </p>
          </div>
        </div>

        {/* Filters & View Toggles */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Day Filter */}
          <select 
            value={filterDay} 
            onChange={(e) => setFilterDay(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none"
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
            className="bg-slate-950 border border-slate-800 text-emerald-400 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="all">🚚 Toda la Flota</option>
            <option value="truck_gula">Camión Gula (Propio)</option>
            <option value="truck_covey">Camión Covey (Alquiler)</option>
            <option value="truck_albacar">Camión Albacar (Alquiler)</option>
          </select>

          {/* Worker Filter */}
          <select 
            value={filterWorker} 
            onChange={(e) => setFilterWorker(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-amber-400 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="all">👥 Todo el Equipo</option>
            <option value="worker_gonzalo">Gonzalo</option>
            <option value="worker_ricardo">Ricardo</option>
            <option value="worker_jaime">Jaime</option>
            <option value="worker_johan">Johan</option>
            <option value="worker_jeferson">Jeferson</option>
            <option value="worker_irene">Irene</option>
            <option value="worker_kerly">Kerly</option>
            <option value="worker_jose">Jose</option>
            <option value="worker_raul">Raúl</option>
          </select>

          {/* View Mode */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setViewMode('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'graph' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🕸️ Grafo
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
        <div className="relative bg-slate-950 border border-slate-800 rounded-3xl p-6 overflow-x-auto shadow-2xl min-h-[540px]">
          {/* Subtle Grid Canvas Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none rounded-3xl" />

          {/* Active selection banner */}
          {selectedNodeObj && (
            <div className="relative z-20 mb-6 bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between text-white animate-fadeIn">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <span className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">Nodo Seleccionado</span>
                  <h4 className="text-sm font-bold text-white">{selectedNodeObj.label}</h4>
                  {selectedNodeObj.sub && <p className="text-xs text-slate-300">{selectedNodeObj.sub}</p>}
                </div>
              </div>
              <button 
                onClick={() => setSelectedNodeId(null)}
                className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl font-bold transition-all"
              >
                Desmarcar Nodo
              </button>
            </div>
          )}

          {/* 4 Interactive Columns Graph View */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6 min-w-[900px]">
            
            {/* COLUMN 1: DÍAS / HITOS */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-blue-400 tracking-wider pb-2 border-b border-slate-800">
                <Calendar className="w-4 h-4" />
                <span>1. Días & Hitos</span>
              </div>

              {dayNodes.map(d => {
                const isSelected = selectedNodeId === d.id;
                const isConnected = connectedNodeIds.has(d.id);
                const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedNodeId(isSelected ? null : d.id)}
                    className={`cursor-pointer transition-all duration-300 p-3.5 rounded-2xl border ${d.color} ${opacityClass} ${
                      isSelected ? 'ring-2 ring-amber-400 scale-[1.03] shadow-lg shadow-amber-500/20' : 'hover:scale-[1.01]'
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

            {/* COLUMN 2: TAREAS & ACTIVIDADES */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-amber-400 tracking-wider pb-2 border-b border-slate-800">
                <Clock className="w-4 h-4" />
                <span>2. Tareas & Operaciones ({taskNodes.length})</span>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {taskNodes.map(t => {
                  const isSelected = selectedNodeId === t.id;
                  const isConnected = connectedNodeIds.has(t.id);
                  const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedNodeId(isSelected ? null : t.id)}
                      className={`cursor-pointer transition-all duration-300 p-3 rounded-2xl border bg-slate-900/80 border-slate-800 ${opacityClass} ${
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
                            className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                          >
                            {t.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                          </button>
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                        )}

                        <div>
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
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-emerald-400 tracking-wider pb-2 border-b border-slate-800">
                <Truck className="w-4 h-4" />
                <span>3. Flota de Camiones</span>
              </div>

              {truckNodes.map(tr => {
                const isSelected = selectedNodeId === tr.id;
                const isConnected = connectedNodeIds.has(tr.id);
                const opacityClass = selectedNodeId && !isConnected ? 'opacity-30 blur-[0.5px]' : 'opacity-100';

                return (
                  <div
                    key={tr.id}
                    onClick={() => setSelectedNodeId(isSelected ? null : tr.id)}
                    className={`cursor-pointer transition-all duration-300 p-3.5 rounded-2xl border ${tr.color} ${opacityClass} ${
                      isSelected ? 'ring-2 ring-emerald-400 scale-[1.03] shadow-lg shadow-emerald-500/20' : 'hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Truck className="w-5 h-5 shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-xs">{tr.label}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{tr.sub}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* COLUMN 4: TRABAJADORES & ROLES */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-black uppercase text-purple-400 tracking-wider pb-2 border-b border-slate-800">
                <Users className="w-4 h-4" />
                <span>4. Personal Asignado</span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[580px] overflow-y-auto pr-1">
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
        <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
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
                <div key={d.id} className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-sm text-amber-400">{d.label}</span>
                      <span className="text-xs text-slate-400">({d.sub})</span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      {completedCount} / {totalCount} Tareas ({pct}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Tasks List snippet */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    {dayTasks.map(t => (
                      <div key={t.id} className="text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-slate-300 flex items-start space-x-2">
                        <Clock className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <span className={t.completed ? 'line-through text-slate-500' : 'text-slate-200'}>
                          {t.label}
                        </span>
                      </div>
                    ))}
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
