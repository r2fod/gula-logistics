import React, { useState } from 'react';
import { 
  Truck, 
  Users, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  ShieldCheck, 
  PackageCheck, 
  Search, 
  Sparkles,
  Share2,
  Check,
  ListTodo,
  AlertCircle
} from 'lucide-react';

import LiveMonitorPanel from './LiveMonitorPanel';

export default function PublicView({ 
  data = {}, 
  workersList = [], 
  clockEntries = [], 
  onToggleTask, 
  onOpenLogin,
  onClockEntryCreated,
  onOpenClockModal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [mobileTab, setMobileTab] = useState('all'); // 'all' | 'live' | 'trucks' | 'team' | 'tasks'

  const handleShareLink = () => {
    const publicUrl = `${window.location.origin}${window.location.pathname}?view=public`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const tasks = (data.tasks || []).filter(t => !t.isPrivate);
  const trucks = (data.trucks && data.trucks.length > 0) ? data.trucks : [
    { name: "Camión Gula", tag: "Propio (Gula)", status: "Operativo — Propiedad Gula Logística" },
    { name: "Camión Covey", tag: "Alquiler Covey", status: "Operativo — Vehículo de Alquiler" },
    { name: "Camión Albacar", tag: "Alquiler Albacar", status: "Operativo — Vehículo de Alquiler" }
  ];
  const team = data.team || [];

  const completedTasksCount = tasks.filter(t => t.completed).length;
  const taskProgressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;

  const filteredTeam = team.filter(item => 
    item.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.members.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Banner Header Status */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900/90 via-slate-900/50 to-slate-950/80 p-4 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{data.meta?.week || "Semana Actual"}</span>
              </div>

              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span>{data.meta?.status || "Operativa Activa"}</span>
              </div>
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight font-['Outfit']">
              Planificación Operativa de Logística
            </h2>

            <div className="flex items-center space-x-2 text-xs sm:text-sm text-slate-300">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>{data.meta?.dateRange || "Del 15 al 20 de Septiembre de 2026"}</span>
            </div>
          </div>

          {/* Metrics & Share Button */}
          <div className="lg:col-span-4 flex flex-col space-y-3 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-800 lg:pl-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                <p className="text-[11px] font-medium text-slate-400">Camiones Activos</p>
                <p className="text-xl sm:text-2xl font-bold text-amber-400 mt-0.5 font-['Outfit']">
                  {trucks.length} Vehículos
                </p>
              </div>
              <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
                <p className="text-[11px] font-medium text-slate-400">Progreso Tareas</p>
                <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-0.5 font-['Outfit']">
                  {taskProgressPercent}%
                </p>
              </div>
            </div>

            <button
              onClick={handleShareLink}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-all shadow-md active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Enlace Público Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Copiar Enlace Público para Compartir</span>
                </>
              )}
            </button>

            {onOpenLogin && (
              <button
                onClick={onOpenLogin}
                className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold transition-all shadow-md active:scale-95"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Acceso Admin / Socias</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Monitor Panel (Tiempo Real) */}
      <LiveMonitorPanel
        workersList={workersList}
        clockEntries={clockEntries}
        activeSchedule={data.schedule || {}}
        onClockEntryCreated={onClockEntryCreated}
        onOpenClockModal={onOpenClockModal}
      />

      {/* Mobile Selector Tabs */}
      <div className="flex md:hidden items-center space-x-1 bg-slate-900/80 p-1 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setMobileTab('all')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
            mobileTab === 'all' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          Todo
        </button>
        <button
          onClick={() => setMobileTab('live')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
            mobileTab === 'live' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          🔴 En Vivo
        </button>
        <button
          onClick={() => setMobileTab('trucks')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
            mobileTab === 'trucks' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          Camiones ({trucks.length})
        </button>
        <button
          onClick={() => setMobileTab('tasks')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors ${
            mobileTab === 'tasks' ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
          }`}
        >
          Checklist ({tasks.length})
        </button>
      </div>

      {/* Section 1: Flota de Camiones (3 Camiones) */}
      {(mobileTab === 'all' || mobileTab === 'trucks') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Truck className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-bold text-white tracking-tight font-['Outfit']">
                Camiones de la Flota Gula
              </h3>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {trucks.length} Unidades
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {trucks.map((truck, i) => (
              <div 
                key={i} 
                className="group relative bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 backdrop-blur-md transition-all hover:-translate-y-1 shadow-lg shadow-slate-950/50 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
                      <Truck className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                      {truck.tag || "Flota"}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-lg font-['Outfit'] group-hover:text-amber-400 transition-colors">
                      {truck.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Ruta & Asignaciones Operativas</p>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center space-x-1.5 text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>{truck.status}</span>
                  </span>
                  <span className="text-slate-500">Gula Ops</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Checklist & Tareas Operativas */}
      {(mobileTab === 'all' || mobileTab === 'tasks') && tasks.length > 0 && (
        <div className="space-y-4 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <ListTodo className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-bold text-white tracking-tight font-['Outfit']">
                Checklist & Tareas Operativas
              </h3>
            </div>

            <div className="text-xs text-slate-400">
              <span className="text-amber-400 font-bold">{completedTasksCount}</span> de <span className="text-white font-bold">{tasks.length}</span> completadas
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${taskProgressPercent}%` }}
            ></div>
          </div>

          {/* Task Items */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onToggleTask(task.id)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  task.completed
                    ? 'bg-slate-950/60 border-slate-800/80 text-slate-400'
                    : 'bg-slate-900 hover:border-amber-500/40 text-slate-100 shadow-md'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div 
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                      task.completed 
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                        : 'border-slate-700 text-transparent hover:border-amber-500'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium break-words ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                      {task.text}
                    </p>
                    <span className="text-[11px] text-slate-400 font-normal truncate block">
                      📌 {task.assignedTo}
                    </span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  task.priority === 'Alta' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-400'
                }`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Equipo de Logística */}
      {(mobileTab === 'all' || mobileTab === 'team') && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-400" />
              <h3 className="text-xl font-bold text-white tracking-tight font-['Outfit']">
                Equipo & Roles Asignados
              </h3>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar rol o persona..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {filteredTeam.map((item, idx) => (
              <div 
                key={idx}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-amber-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
                    {item.role}
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-bold text-white font-['Outfit']">
                    {item.role}
                  </h4>
                  <p className="text-sm text-slate-300 mt-2 font-medium bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                    {item.members}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
