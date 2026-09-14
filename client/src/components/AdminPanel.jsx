import React, { useState } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  X, 
  Truck, 
  Users, 
  Calendar, 
  ListTodo, 
  Sparkles,
  ShieldCheck,
  PackageCheck,
  AlertCircle
} from 'lucide-react';

export default function AdminPanel({ data, onChangeData, onLogout }) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'team' | 'trucks' | 'tasks'

  // General state handlers
  const [meta, setMeta] = useState(data.meta || { week: 'Semana 3', dateRange: '', status: 'Operativa Activa' });
  const [team, setTeam] = useState(data.team || []);
  const [trucks, setTrucks] = useState(data.trucks || []);
  const [tasks, setTasks] = useState(data.tasks || [
    { id: '1', text: 'Revisión de aceites y combustible', assignedTo: 'Camión Gula', priority: 'Alta', completed: true },
    { id: '2', text: 'Carga de cajas térmicas de evento', assignedTo: 'Base & Preparación', priority: 'Alta', completed: false },
    { id: '3', text: 'Limpieza de cámara frigorífica de Camión Covey', assignedTo: 'Camión Covey', priority: 'Media', completed: false }
  ]);

  // Form states
  const [newTeamRole, setNewTeamRole] = useState('');
  const [newTeamMembers, setNewTeamMembers] = useState('');

  const [newTruckName, setNewTruckName] = useState('');
  const [newTruckTag, setNewTruckTag] = useState('');
  const [newTruckStatus, setNewTruckStatus] = useState('Activo / En Ruta');

  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Camión Gula');
  const [newTaskPriority, setNewTaskPriority] = useState('Alta');

  const handleSaveAll = () => {
    const updatedData = {
      ...data,
      meta,
      team,
      trucks,
      tasks
    };
    onChangeData(updatedData);
  };

  // Team Handlers
  const handleAddTeamRole = (e) => {
    e.preventDefault();
    if (!newTeamRole.trim() || !newTeamMembers.trim()) return;
    const newItem = {
      role: newTeamRole.trim(),
      members: newTeamMembers.trim(),
      category: 'fleet'
    };
    const updatedTeam = [...team, newItem];
    setTeam(updatedTeam);
    setNewTeamRole('');
    setNewTeamMembers('');
    onChangeData({ ...data, meta, team: updatedTeam, trucks, tasks });
  };

  const handleDeleteTeamRole = (index) => {
    const updatedTeam = team.filter((_, i) => i !== index);
    setTeam(updatedTeam);
    onChangeData({ ...data, meta, team: updatedTeam, trucks, tasks });
  };

  // Truck Handlers
  const handleAddTruck = (e) => {
    e.preventDefault();
    if (!newTruckName.trim()) return;
    const newTruck = {
      name: newTruckName.trim(),
      tag: newTruckTag.trim() || 'Flota Gula',
      status: newTruckStatus
    };
    const updatedTrucks = [...trucks, newTruck];
    setTrucks(updatedTrucks);
    setNewTruckName('');
    setNewTruckTag('');
    onChangeData({ ...data, meta, team, trucks: updatedTrucks, tasks });
  };

  const handleDeleteTruck = (index) => {
    const updatedTrucks = trucks.filter((_, i) => i !== index);
    setTrucks(updatedTrucks);
    onChangeData({ ...data, meta, team, trucks: updatedTrucks, tasks });
  };

  const handleTruckStatusChange = (index, newStatus) => {
    const updatedTrucks = trucks.map((item, i) => i === index ? { ...item, status: newStatus } : item);
    setTrucks(updatedTrucks);
    onChangeData({ ...data, meta, team, trucks: updatedTrucks, tasks });
  };

  // Task Handlers
  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const newTask = {
      id: Date.now().toString(),
      text: newTaskText.trim(),
      assignedTo: newTaskAssignee,
      priority: newTaskPriority,
      completed: false
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    setNewTaskText('');
    onChangeData({ ...data, meta, team, trucks, tasks: updatedTasks });
  };

  const handleDeleteTask = (id) => {
    const updatedTasks = tasks.filter(t => t.id !== id);
    setTasks(updatedTasks);
    onChangeData({ ...data, meta, team, trucks, tasks: updatedTasks });
  };

  const handleToggleTask = (id) => {
    const updatedTasks = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(updatedTasks);
    onChangeData({ ...data, meta, team, trucks, tasks: updatedTasks });
  };

  return (
    <div className="space-y-6">
      {/* Admin Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900 border border-amber-500/30 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-white font-['Outfit']">Modo Administración Activo</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-500 text-slate-950">EDITABLE</span>
            </div>
            <p className="text-xs text-slate-400">Edita datos, miembros, camiones y tareas en tiempo real</p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={handleSaveAll}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Guardar Cambios</span>
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
          >
            Salir Admin
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'general'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Información General</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'team'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Equipo ({team.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('trucks')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'trucks'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Flota de Camiones ({trucks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'tasks'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <ListTodo className="w-4 h-4" />
          <span>Tareas & Checklist ({tasks.length})</span>
        </button>
      </div>

      {/* Tab 1: General Info */}
      {activeTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>Datos Generales de la Semana</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Número de Semana
              </label>
              <input
                type="text"
                value={meta.week}
                onChange={(e) => {
                  const newMeta = { ...meta, week: e.target.value };
                  setMeta(newMeta);
                  onChangeData({ ...data, meta: newMeta, team, trucks, tasks });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Rango de Fechas
              </label>
              <input
                type="text"
                value={meta.dateRange}
                onChange={(e) => {
                  const newMeta = { ...meta, dateRange: e.target.value };
                  setMeta(newMeta);
                  onChangeData({ ...data, meta: newMeta, team, trucks, tasks });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Estado Operativo
              </label>
              <select
                value={meta.status}
                onChange={(e) => {
                  const newMeta = { ...meta, status: e.target.value };
                  setMeta(newMeta);
                  onChangeData({ ...data, meta: newMeta, team, trucks, tasks });
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
              >
                <option value="Operativa Activa">Operativa Activa</option>
                <option value="Preparación">Preparación</option>
                <option value="En Pausa">En Pausa</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Team Management */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <form onSubmit={handleAddTeamRole} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Añadir Nuevo Rol o Grupo al Equipo</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre del Rol / Cargo
                </label>
                <input
                  type="text"
                  placeholder="ej. Apoyo Eventos, Coordinador"
                  value={newTeamRole}
                  onChange={(e) => setNewTeamRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Miembros Asignados
                </label>
                <input
                  type="text"
                  placeholder="ej. María, Carlos, Pedro"
                  value={newTeamMembers}
                  onChange={(e) => setNewTeamMembers(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir al Equipo</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {team.map((item, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-white">{item.role}</h4>
                  <p className="text-xs text-slate-400 mt-1">{item.members}</p>
                </div>
                <button
                  onClick={() => handleDeleteTeamRole(idx)}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                  title="Eliminar rol"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Trucks Management */}
      {activeTab === 'trucks' && (
        <div className="space-y-6">
          <form onSubmit={handleAddTruck} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Añadir Nuevo Camión a la Flota</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Nombre del Vehículo
                </label>
                <input
                  type="text"
                  placeholder="ej. Camión Isuzu 4"
                  value={newTruckName}
                  onChange={(e) => setNewTruckName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Etiqueta / Tipo
                </label>
                <input
                  type="text"
                  placeholder="ej. Frigorífico, Carga Ligera"
                  value={newTruckTag}
                  onChange={(e) => setNewTruckTag(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Estado Inicial
                </label>
                <select
                  value={newTruckStatus}
                  onChange={(e) => setNewTruckStatus(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                >
                  <option value="Activo / En Ruta">Activo / En Ruta</option>
                  <option value="En Base">En Base</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Camión</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trucks.map((truck, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-white">{truck.name}</h4>
                  </div>
                  <button
                    onClick={() => handleDeleteTruck(idx)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-slate-400">Estado del Vehículo</label>
                  <select
                    value={truck.status}
                    onChange={(e) => handleTruckStatusChange(idx, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-emerald-400 focus:outline-none"
                  >
                    <option value="Activo / En Ruta">Activo / En Ruta</option>
                    <option value="En Base">En Base</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Tasks & Checklist Management */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <form onSubmit={handleAddTask} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Crear Nueva Tarea u Orden Operativa</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Descripción de la Tarea
                </label>
                <input
                  type="text"
                  placeholder="ej. Cargar 50 cajas térmicas en Camión Albacar"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Asignado a
                </label>
                <select
                  value={newTaskAssignee}
                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                >
                  <option value="Camión Gula">Camión Gula</option>
                  <option value="Camión Covey">Camión Covey</option>
                  <option value="Camión Albacar">Camión Albacar</option>
                  <option value="Base & Preparación">Base & Preparación</option>
                  <option value="Jefe Logística">Jefe Logística</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Prioridad
                </label>
                <select
                  value={newTaskPriority}
                  onChange={(e) => setNewTaskPriority(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500/60"
                >
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400 transition-colors flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Tarea</span>
            </button>
          </form>

          {/* List of Tasks */}
          <div className="space-y-3">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  task.completed 
                    ? 'bg-slate-950/60 border-slate-800/80 opacity-75' 
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleToggleTask(task.id)}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-colors ${
                      task.completed 
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                        : 'border-slate-700 hover:border-amber-500 text-transparent'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div>
                    <p className={`text-sm font-medium ${task.completed ? 'line-through text-slate-400' : 'text-white'}`}>
                      {task.text}
                    </p>
                    <div className="flex items-center space-x-3 mt-1 text-[11px] text-slate-400">
                      <span>📌 {task.assignedTo}</span>
                      <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                        task.priority === 'Alta' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
