import React, { useState, useEffect } from 'react';
import { X, Edit3, Save, Plus, Trash2, Calendar } from 'lucide-react';

export default function AdminTaskEditorModal({ isOpen, onClose, activeWeekData, workersList = [], onSaveWeekData }) {
  const [localWeek, setLocalWeek] = useState(null);

  useEffect(() => {
    if (isOpen && activeWeekData) {
      // Deep clone to avoid mutating state directly while editing
      setLocalWeek(JSON.parse(JSON.stringify(activeWeekData)));
    }
  }, [isOpen, activeWeekData]);

  if (!isOpen || !localWeek) return null;

  const handleTaskChange = (dayKey, taskIndex, newValue) => {
    const updated = { ...localWeek };
    
    if (dayKey === 'sundayMonday') {
      const task = updated.sundayMonday.tasks[taskIndex];
      if (typeof task === 'string') {
        updated.sundayMonday.tasks[taskIndex] = newValue;
      } else {
        updated.sundayMonday.tasks[taskIndex].text = newValue;
      }
    } else {
      const task = updated.schedule[dayKey].tasks[taskIndex];
      if (typeof task === 'string') {
        updated.schedule[dayKey].tasks[taskIndex] = { text: task, timeFrame: '', mapsUrl: '' };
        updated.schedule[dayKey].tasks[taskIndex].text = newValue;
      } else {
        updated.schedule[dayKey].tasks[taskIndex].text = newValue;
      }
    }
    setLocalWeek(updated);
  };

  const handleTaskMetadataChange = (dayKey, taskIndex, field, newValue) => {
    const updated = { ...localWeek };
    const taskList = dayKey === 'sundayMonday' ? updated.sundayMonday.tasks : updated.schedule[dayKey].tasks;
    const task = taskList[taskIndex];
    
    if (typeof task === 'string') {
      taskList[taskIndex] = { text: task, [field]: newValue };
    } else {
      taskList[taskIndex][field] = newValue;
    }
    setLocalWeek(updated);
  };

  const handleAddTask = (dayKey) => {
    const updated = { ...localWeek };
    if (dayKey === 'sundayMonday') {
      if (!updated.sundayMonday.tasks) updated.sundayMonday.tasks = [];
      updated.sundayMonday.tasks.push({ text: "Nueva Tarea", timeFrame: "", mapsUrl: "" });
    } else {
      if (!updated.schedule[dayKey].tasks) updated.schedule[dayKey].tasks = [];
      updated.schedule[dayKey].tasks.push({ text: "Nueva Tarea", timeFrame: "", mapsUrl: "" });
    }
    setLocalWeek(updated);
  };

  const handleDeleteTask = (dayKey, taskIndex) => {
    const updated = { ...localWeek };
    if (dayKey === 'sundayMonday') {
      updated.sundayMonday.tasks.splice(taskIndex, 1);
    } else {
      updated.schedule[dayKey].tasks.splice(taskIndex, 1);
    }
    setLocalWeek(updated);
  };

  const handleWeddingChange = (weddingIndex, field, newValue) => {
    const updated = { ...localWeek };
    updated.saturdaySpecial.weddings[weddingIndex][field] = newValue;
    setLocalWeek(updated);
  };

  // Toggle a worker in/out of a task's or wedding's `assigned` list — this is
  // what actually assigns "who does this", vs. it just being free text.
  const toggleAssignedWorker = (dayKey, taskIndex, workerName) => {
    const updated = { ...localWeek };
    const taskList = dayKey === 'sundayMonday' ? updated.sundayMonday.tasks : updated.schedule[dayKey].tasks;
    const task = taskList[taskIndex];
    const current = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
    const next = current.includes(workerName) ? current.filter(n => n !== workerName) : [...current, workerName];

    if (typeof task === 'string') {
      taskList[taskIndex] = { text: task, assigned: next };
    } else {
      taskList[taskIndex].assigned = next;
    }
    setLocalWeek(updated);
  };

  const toggleAssignedWedding = (weddingIndex, workerName) => {
    const updated = { ...localWeek };
    const wedding = updated.saturdaySpecial.weddings[weddingIndex];
    const current = Array.isArray(wedding.assigned) ? wedding.assigned : [];
    wedding.assigned = current.includes(workerName) ? current.filter(n => n !== workerName) : [...current, workerName];
    setLocalWeek(updated);
  };

  const AssignedPicker = ({ assigned = [], onToggle }) => (
    <div className="flex flex-wrap gap-1.5">
      {workersList.map(w => {
        const isChecked = assigned.includes(w.name);
        return (
          <button
            key={w.name}
            type="button"
            onClick={() => onToggle(w.name)}
            className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
              isChecked
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
            }`}
          >
            <span>{w.avatar}</span>
            <span>{w.name}</span>
          </button>
        );
      })}
    </div>
  );

  const handleSave = () => {
    onSaveWeekData(localWeek);
    onClose();
  };

  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <Edit3 className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold font-['Outfit']">Editor Manual del Planning</h3>
              <p className="text-xs text-slate-400">Modificando: {localWeek.name || 'Semana'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-8">
          
          {/* Normal Days */}
          {days.map(dayKey => {
            if (!localWeek.schedule[dayKey]) return null;
            return (
              <div key={dayKey} className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-amber-400 capitalize flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {localWeek.schedule[dayKey].title}
                  </h4>
                  <button 
                    onClick={() => handleAddTask(dayKey)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Añadir Tarea
                  </button>
                </div>
                
                <div className="space-y-3">
                  {localWeek.schedule[dayKey].tasks.map((task, idx) => {
                    const textValue = typeof task === 'object' ? task.text : task;
                    const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                    const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                    const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                    const truckValue = typeof task === 'object' ? (task.truck || '') : '';

                    return (
                      <div key={idx} className="flex gap-2 items-start bg-slate-900 border border-slate-700 rounded-xl p-3">
                        <div className="flex-1 space-y-2">
                          <textarea
                            value={textValue}
                            onChange={(e) => handleTaskChange(dayKey, idx, e.target.value)}
                            placeholder="Descripción de la tarea..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-y min-h-[40px]"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={timeValue}
                              onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'timeFrame', e.target.value)}
                              placeholder="Horario (ej: 09:00 - 11:30)"
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                            />
                            <input
                              type="text"
                              value={mapsValue}
                              onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'mapsUrl', e.target.value)}
                              placeholder="URL de Google Maps"
                              className="flex-[2] bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-blue-300 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                            <select
                              value={truckValue}
                              onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'truck', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                            >
                              <option value="">Sin camión / no aplica</option>
                              <option value="Camión Gula">Camión Gula</option>
                              <option value="Camión Covey">Camión Covey</option>
                              <option value="Camión Albacar">Camión Albacar</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                            <AssignedPicker
                              assigned={assignedValue}
                              onToggle={(workerName) => toggleAssignedWorker(dayKey, idx, workerName)}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask(dayKey, idx)}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                  {localWeek.schedule[dayKey].tasks.length === 0 && (
                    <p className="text-xs text-slate-500 italic">No hay tareas para este día.</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Saturday */}
          {localWeek.saturdaySpecial && (
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-rose-900/30">
              <h4 className="text-sm font-bold text-rose-400 mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {localWeek.saturdaySpecial.title}
              </h4>
              <div className="space-y-4">
                {localWeek.saturdaySpecial.weddings.map((w, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl grid grid-cols-1 gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Ubicación</label>
                        <input 
                          type="text" 
                          value={w.location} 
                          onChange={(e) => handleWeddingChange(idx, 'location', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                        <input 
                          type="text" 
                          value={w.truck} 
                          onChange={(e) => handleWeddingChange(idx, 'truck', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Logística (Asignados)</label>
                      <input 
                        type="text" 
                        value={w.details} 
                        onChange={(e) => handleWeddingChange(idx, 'details', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Horario</label>
                        <input 
                          type="text" 
                          value={w.timeFrame || ''} 
                          onChange={(e) => handleWeddingChange(idx, 'timeFrame', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Google Maps URL</label>
                        <input 
                          type="text" 
                          value={w.mapsUrl || ''} 
                          onChange={(e) => handleWeddingChange(idx, 'mapsUrl', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-blue-300 focus:border-rose-500 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                      <AssignedPicker
                        assigned={Array.isArray(w.assigned) ? w.assigned : []}
                        onToggle={(workerName) => toggleAssignedWedding(idx, workerName)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sunday/Monday */}
          {localWeek.sundayMonday && (
            <div className="bg-slate-950/50 p-4 rounded-2xl border border-emerald-900/30">
               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {localWeek.sundayMonday.title}
                  </h4>
                  <button 
                    onClick={() => handleAddTask('sundayMonday')}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Añadir Tarea
                  </button>
                </div>
              <div className="space-y-3">
                  {localWeek.sundayMonday.tasks.map((task, idx) => {
                    const textValue = typeof task === 'object' ? task.text : task;
                    const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                    const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                    const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                    const truckValue = typeof task === 'object' ? (task.truck || '') : '';

                    return (
                      <div key={idx} className="flex gap-2 items-start bg-slate-900 border border-slate-700 rounded-xl p-3">
                        <div className="flex-1 space-y-2">
                          <textarea
                            value={textValue}
                            onChange={(e) => handleTaskChange('sundayMonday', idx, e.target.value)}
                            placeholder="Descripción de la tarea..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y min-h-[40px]"
                          />
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={timeValue}
                              onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'timeFrame', e.target.value)}
                              placeholder="Horario (ej: 09:00 - 11:30)"
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                            />
                            <input
                              type="text"
                              value={mapsValue}
                              onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'mapsUrl', e.target.value)}
                              placeholder="URL de Google Maps"
                              className="flex-[2] bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-blue-300 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                            <select
                              value={truckValue}
                              onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'truck', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                            >
                              <option value="">Sin camión / no aplica</option>
                              <option value="Camión Gula">Camión Gula</option>
                              <option value="Camión Covey">Camión Covey</option>
                              <option value="Camión Albacar">Camión Albacar</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                            <AssignedPicker
                              assigned={assignedValue}
                              onToggle={(workerName) => toggleAssignedWorker('sundayMonday', idx, workerName)}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteTask('sundayMonday', idx)}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center mt-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 shrink-0">
          <button 
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Guardar y Actualizar Planning
          </button>
        </div>
      </div>
    </div>
  );
}
