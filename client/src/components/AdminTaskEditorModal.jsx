import React, { useState, useEffect, useRef } from 'react';
import { X, Edit3, Save, Plus, Trash2, Calendar, ChevronUp, ChevronDown } from 'lucide-react';

const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// El campo de horario era texto libre ("9:30 - 10:30", "10:00-14:00",
// "13:00-16:00"...) — de ahí salían la mayoría de horas mal formateadas o
// con solapes difíciles de detectar. Un selector de hora nativo obliga a
// HH:MM y evita esos despistes. Mantenemos "Pendiente" como estado aparte
// para tareas que de verdad no tienen hora todavía.
function parseTimeFrame(tf) {
  tf = (tf || '').trim();
  if (!tf) return { start: '', end: '', pending: false };
  if (tf.toLowerCase() === 'pendiente') return { start: '', end: '', pending: true };

  // Separar por el guion si existe
  const parts = tf.split('-');
  if (parts.length >= 2) {
    return { start: parts[0].trim(), end: parts[1].trim(), pending: false };
  } else {
    // Si no hay guion, podría ser una hora única válida o texto libre
    if (/^\d{1,2}:\d{2}$/.test(tf)) {
      return { start: tf, end: '', pending: false };
    }
    // Si es texto libre que no es hora, se considera pendiente
    return { start: '', end: '', pending: true };
  }
}

function formatTimeFrame(start, end) {
  if (!start && !end) return '';
  return `${start || ''}-${end || ''}`;
}

function TimeRangeEditor({ value, onChange }) {
  const { start, end, pending } = parseTimeFrame(value);
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          value={start}
          disabled={pending}
          onChange={(e) => onChange(formatTimeFrame(e.target.value, end))}
          className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 disabled:opacity-40 [color-scheme:dark]"
        />
        <span className="text-slate-500 text-[11px] shrink-0">a</span>
        <input
          type="time"
          value={end}
          disabled={pending}
          onChange={(e) => onChange(formatTimeFrame(start, e.target.value))}
          className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500 disabled:opacity-40 [color-scheme:dark]"
        />
      </div>
      <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={pending}
          onChange={(e) => onChange(e.target.checked ? 'Pendiente' : '')}
          className="accent-amber-500"
        />
        Sin horario fijo (pendiente)
      </label>
    </div>
  );
}

export default function AdminTaskEditorModal({ isOpen, onClose, activeWeekData, workersList = [], onSaveWeekData }) {
  const [localWeek, setLocalWeek] = useState(null);
  const [activeDayId, setActiveDayId] = useState('martes');
  const wasOpenRef = useRef(false);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    // Solo recargar del servidor al ABRIR el modal (transición false→true) —
    // si se recarga en cada cambio de `activeWeekData`, el poll de fondo de
    // App.jsx (refetch cada 20s) pisa cualquier edición a medio hacer con el
    // dato viejo del servidor, borrando lo que se esté escribiendo.
    if (isOpen && !wasOpenRef.current && activeWeekData) {
      setLocalWeek(JSON.parse(JSON.stringify(activeWeekData)));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, activeWeekData]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !isOpen || !localWeek) return;

    const availableDays = [
      ...days.filter(d => localWeek.schedule && localWeek.schedule[d]),
      ...(localWeek.saturdaySpecial ? ['sabado'] : []),
      ...(localWeek.sundayMonday ? ['sundayMonday'] : [])
    ];

    if (availableDays.length > 0 && !availableDays.includes(activeDayId)) {
      setActiveDayId(availableDays[0]);
    }

    const handleScroll = () => {
      const containerRect = container.getBoundingClientRect();
      const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 40;

      if (isAtBottom && availableDays.length > 0) {
        setActiveDayId(availableDays[availableDays.length - 1]);
        return;
      }

      let currentActive = availableDays[0];
      for (const dayKey of availableDays) {
        const el = document.getElementById(`editor-day-${dayKey}`);
        if (el) {
          const elRect = el.getBoundingClientRect();
          const relativeTop = elRect.top - containerRect.top;
          if (relativeTop <= 60) {
            currentActive = dayKey;
          }
        }
      }

      if (currentActive) {
        setActiveDayId(currentActive);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => container.removeEventListener('scroll', handleScroll);
  }, [localWeek, isOpen]);

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

  // Escribir el nombre/dirección del sitio genera el link de Google Maps
  // solo — ya no hace falta copiar y pegar la URL a mano.
  const buildMapsUrl = (place) => place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : '';

  const handleTaskMetadataChange = (dayKey, taskIndex, field, newValue) => {
    const updated = { ...localWeek };
    const taskList = dayKey === 'sundayMonday' ? updated.sundayMonday.tasks : updated.schedule[dayKey].tasks;
    const task = taskList[taskIndex];

    if (typeof task === 'string') {
      taskList[taskIndex] = { text: task, [field]: newValue };
    } else {
      taskList[taskIndex][field] = newValue;
      if (field === 'location') {
        taskList[taskIndex].mapsUrl = buildMapsUrl(newValue);
      }
    }
    setLocalWeek(updated);
  };

  const handleAddTask = (dayKey) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const newTask = { text: "Nueva Tarea", timeFrame: "", mapsUrl: "", location: "", phone: "", truck: "", assigned: [] };
      if (dayKey === 'sundayMonday') {
        return {
          ...prev,
          sundayMonday: {
            ...prev.sundayMonday,
            tasks: [...(prev.sundayMonday?.tasks || []), newTask]
          }
        };
      } else {
        const daySchedule = prev.schedule?.[dayKey] || { title: dayKey, tasks: [] };
        return {
          ...prev,
          schedule: {
            ...prev.schedule,
            [dayKey]: {
              ...daySchedule,
              tasks: [...(daySchedule.tasks || []), newTask]
            }
          }
        };
      }
    });
  };

  const handleDeleteTask = (dayKey, taskIndex) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      if (dayKey === 'sundayMonday') {
        const tasks = [...(prev.sundayMonday?.tasks || [])];
        tasks.splice(taskIndex, 1);
        return {
          ...prev,
          sundayMonday: {
            ...prev.sundayMonday,
            tasks
          }
        };
      } else {
        const daySchedule = prev.schedule?.[dayKey];
        if (!daySchedule) return prev;
        const tasks = [...(daySchedule.tasks || [])];
        tasks.splice(taskIndex, 1);
        return {
          ...prev,
          schedule: {
            ...prev.schedule,
            [dayKey]: {
              ...daySchedule,
              tasks
            }
          }
        };
      }
    });
  };

  const handleMoveTask = (dayKey, taskIndex, direction) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const targetIndex = taskIndex + direction;
      if (dayKey === 'sundayMonday') {
        const tasks = [...(prev.sundayMonday?.tasks || [])];
        if (targetIndex < 0 || targetIndex >= tasks.length) return prev;
        const [moved] = tasks.splice(taskIndex, 1);
        tasks.splice(targetIndex, 0, moved);
        return {
          ...prev,
          sundayMonday: {
            ...prev.sundayMonday,
            tasks
          }
        };
      } else {
        const daySchedule = prev.schedule?.[dayKey];
        if (!daySchedule) return prev;
        const tasks = [...(daySchedule.tasks || [])];
        if (targetIndex < 0 || targetIndex >= tasks.length) return prev;
        const [moved] = tasks.splice(taskIndex, 1);
        tasks.splice(targetIndex, 0, moved);
        return {
          ...prev,
          schedule: {
            ...prev.schedule,
            [dayKey]: {
              ...daySchedule,
              tasks
            }
          }
        };
      }
    });
  };

  const handleAddWedding = () => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const newWedding = {
        location: "Nueva Finca / Boda",
        truck: "Camión Gula",
        details: "",
        timeFrame: "",
        mapsUrl: "",
        phone: "",
        assigned: []
      };
      const saturday = prev.saturdaySpecial || { title: "Sábado — Eventos Simultáneos", weddings: [] };
      return {
        ...prev,
        saturdaySpecial: {
          ...saturday,
          weddings: [...(saturday.weddings || []), newWedding]
        }
      };
    });
  };

  const handleDeleteWedding = (weddingIndex) => {
    setLocalWeek(prev => {
      if (!prev?.saturdaySpecial?.weddings) return prev;
      const weddings = [...prev.saturdaySpecial.weddings];
      weddings.splice(weddingIndex, 1);
      return {
        ...prev,
        saturdaySpecial: {
          ...prev.saturdaySpecial,
          weddings
        }
      };
    });
  };

  const handleMoveWedding = (weddingIndex, direction) => {
    setLocalWeek(prev => {
      if (!prev?.saturdaySpecial?.weddings) return prev;
      const weddings = [...prev.saturdaySpecial.weddings];
      const targetIndex = weddingIndex + direction;
      if (targetIndex < 0 || targetIndex >= weddings.length) return prev;
      const [moved] = weddings.splice(weddingIndex, 1);
      weddings.splice(targetIndex, 0, moved);
      return {
        ...prev,
        saturdaySpecial: {
          ...prev.saturdaySpecial,
          weddings
        }
      };
    });
  };

  const handleWeddingChange = (weddingIndex, field, newValue) => {
    const updated = { ...localWeek };
    updated.saturdaySpecial.weddings[weddingIndex][field] = newValue;
    if (field === 'location') {
      updated.saturdaySpecial.weddings[weddingIndex].mapsUrl = buildMapsUrl(newValue);
    }
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

  const scrollToDay = (dayKey) => {
    setActiveDayId(dayKey);
    const el = document.getElementById(`editor-day-${dayKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl text-white max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shadow-lg">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
                <Edit3 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold font-['Outfit']">Editor Manual del Planning</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Modificando: {localWeek.name || 'Semana'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Day Jump Ribbon with Illuminated Active Day */}
        <div className="bg-slate-950/95 backdrop-blur-md px-3 sm:px-6 py-2.5 border-b border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
          <span className="text-[10px] uppercase font-black text-amber-400 whitespace-nowrap mr-1 flex items-center gap-1">
            <span>📍</span>
            <span>Ir a:</span>
          </span>
          {days.filter(d => localWeek.schedule[d]).map(d => {
            const isActive = activeDayId === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => scrollToDay(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap capitalize flex items-center gap-1.5 border active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/50 scale-105'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                )}
                <span>{localWeek.schedule[d].title || d}</span>
              </button>
            );
          })}
          {localWeek.saturdaySpecial && (() => {
            const isActive = activeDayId === 'sabado';
            return (
              <button
                type="button"
                onClick={() => scrollToDay('sabado')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 border active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white border-rose-300 shadow-lg shadow-rose-500/30 ring-2 ring-rose-400/50 scale-105'
                    : 'bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 border-rose-900/40'
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                )}
                <span>Sábado 👑</span>
              </button>
            );
          })()}
          {localWeek.sundayMonday && (() => {
            const isActive = activeDayId === 'sundayMonday';
            return (
              <button
                type="button"
                onClick={() => scrollToDay('sundayMonday')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 border active:scale-95 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-slate-950 border-emerald-300 shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50 scale-105'
                    : 'bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-300 border-emerald-900/40'
                }`}
              >
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                )}
                <span>Dom &amp; Lun</span>
              </button>
            );
          })()}
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="overflow-y-auto px-4 sm:px-6 pb-6 pt-0 space-y-6 sm:space-y-8">
          
          {/* Normal Days */}
          {days.map(dayKey => {
            if (!localWeek.schedule[dayKey]) return null;
            const currentTasks = localWeek.schedule[dayKey].tasks || [];

            return (
              <div key={dayKey} id={`editor-day-${dayKey}`} className="bg-slate-950/50 rounded-2xl border border-slate-800 shadow-lg scroll-mt-2 first:mt-4">
                {/* STICKY DAY HEADER - Never hides on scroll! */}
                <div className="sticky top-0 z-20 bg-slate-900 px-4 py-3 border-b border-slate-800/80 rounded-t-2xl flex items-center justify-between shadow-md">
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <h4 className="text-sm font-extrabold text-amber-400 capitalize truncate">
                      {localWeek.schedule[dayKey].title}
                    </h4>
                    <span className="text-[10px] font-bold bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                      {currentTasks.length} {currentTasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleAddTask(dayKey)}
                    className="text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Añadir Tarea
                  </button>
                </div>
                
                <div className="p-3 sm:p-4 space-y-3">
                  {currentTasks.map((task, idx) => {
                    const textValue = typeof task === 'object' ? task.text : task;
                    const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                    const locationValue = typeof task === 'object' ? (task.location || '') : '';
                    const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                    const phoneValue = typeof task === 'object' ? (task.phone || '') : '';
                    const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                    const truckValue = typeof task === 'object' ? (task.truck || '') : '';

                    return (
                      <div key={idx} className="flex gap-2.5 items-start bg-slate-900 border border-slate-700/90 rounded-xl p-3 sm:p-3.5 transition-all">
                        {/* Reorder Up/Down Column */}
                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveTask(dayKey, idx, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                            title="Subir tarea"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <span className="text-[10px] font-mono font-bold text-slate-400 select-none">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            disabled={idx === currentTasks.length - 1}
                            onClick={() => handleMoveTask(dayKey, idx, 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:hover:bg-slate-800 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                            title="Bajar tarea"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0 space-y-2">
                          <textarea
                            value={textValue}
                            onChange={(e) => handleTaskChange(dayKey, idx, e.target.value)}
                            placeholder="Descripción de la tarea..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 resize-y min-h-[40px]"
                          />
                          <div className="flex flex-col sm:flex-row gap-2">
                            <TimeRangeEditor
                              value={timeValue}
                              onChange={(v) => handleTaskMetadataChange(dayKey, idx, 'timeFrame', v)}
                            />
                            <input
                              type="tel"
                              value={phoneValue}
                              onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'phone', e.target.value)}
                              placeholder="Teléfono de contacto"
                              className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={locationValue}
                              onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'location', e.target.value)}
                              placeholder="Ubicación / dirección (genera el link de Maps solo)"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                            />
                            {mapsValue && (
                              <a href={mapsValue} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline mt-1 inline-block">
                                📍 Abrir en Google Maps
                              </a>
                            )}
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
                          type="button"
                          onClick={() => handleDeleteTask(dayKey, idx)}
                          className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center mt-1"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}

                  {currentTasks.length === 0 && (
                    <p className="text-xs text-slate-500 italic py-2">No hay tareas para este día.</p>
                  )}

                  {/* Dedicated Bottom Add Button */}
                  <button
                    type="button"
                    onClick={() => handleAddTask(dayKey)}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-700/80 hover:border-amber-500/60 rounded-xl text-xs font-semibold text-slate-400 hover:text-amber-300 hover:bg-amber-500/5 transition-all flex items-center justify-center gap-1.5 group mt-1"
                  >
                    <Plus className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    <span>+ Añadir Tarea al final de {localWeek.schedule[dayKey].title}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Saturday */}
          {localWeek.saturdaySpecial && (
            <div id="editor-day-sabado" className="bg-slate-950/50 rounded-2xl border border-rose-900/40 shadow-lg scroll-mt-2 first:mt-4">
              {/* STICKY SATURDAY HEADER */}
              <div className="sticky top-0 z-20 bg-slate-900 px-4 py-3 border-b border-rose-900/40 rounded-t-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-rose-400 shrink-0" />
                  <h4 className="text-sm font-extrabold text-rose-400 truncate">
                    {localWeek.saturdaySpecial.title}
                  </h4>
                  <span className="text-[10px] font-bold bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                    {(localWeek.saturdaySpecial.weddings || []).length} eventos
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={handleAddWedding}
                  className="text-xs bg-rose-500 hover:bg-rose-400 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-500/20 active:scale-95 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir Evento
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                {(localWeek.saturdaySpecial.weddings || []).map((w, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-3.5">
                    {/* Reorder Up/Down */}
                    <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveWedding(idx, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                        title="Subir evento"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] font-mono font-bold text-slate-400 select-none">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        disabled={idx === (localWeek.saturdaySpecial.weddings || []).length - 1}
                        onClick={() => handleMoveWedding(idx, 1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                        title="Bajar evento"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Ubicación / Finca</label>
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
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Logística (Asignados / Notas)</label>
                        <input 
                          type="text" 
                          value={w.details} 
                          onChange={(e) => handleWeddingChange(idx, 'details', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Horario</label>
                          <TimeRangeEditor
                            value={w.timeFrame || ''}
                            onChange={(v) => handleWeddingChange(idx, 'timeFrame', v)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Teléfono</label>
                          <input
                            type="tel"
                            value={w.phone || ''}
                            onChange={(e) => handleWeddingChange(idx, 'phone', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-white focus:border-rose-500 outline-none"
                          />
                        </div>
                      </div>
                      {w.mapsUrl && (
                        <a href={w.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline inline-block">
                          📍 Abrir en Google Maps
                        </a>
                      )}
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                        <AssignedPicker
                          assigned={Array.isArray(w.assigned) ? w.assigned : []}
                          onToggle={(workerName) => toggleAssignedWedding(idx, workerName)}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWedding(idx)}
                      className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center mt-1"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Bottom Add Wedding Button */}
                <button
                  type="button"
                  onClick={handleAddWedding}
                  className="w-full py-2.5 px-3 border border-dashed border-rose-900/60 hover:border-rose-500/60 rounded-xl text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/5 transition-all flex items-center justify-center gap-1.5 group mt-1"
                >
                  <Plus className="w-4 h-4 text-rose-400" />
                  <span>+ Añadir Evento / Boda al final de Sábado</span>
                </button>
              </div>
            </div>
          )}

          {/* Sunday/Monday */}
          {localWeek.sundayMonday && (
            <div id="editor-day-sundayMonday" className="bg-slate-950/50 rounded-2xl border border-emerald-900/40 shadow-lg scroll-mt-2 first:mt-4">
              {/* STICKY SUNDAY/MONDAY HEADER */}
              <div className="sticky top-0 z-20 bg-slate-900 px-4 py-3 border-b border-emerald-900/40 rounded-t-2xl flex items-center justify-between shadow-md">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                  <h4 className="text-sm font-extrabold text-emerald-400 truncate">
                    {localWeek.sundayMonday.title}
                  </h4>
                  <span className="text-[10px] font-bold bg-slate-950 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800 shrink-0">
                    {(localWeek.sundayMonday.tasks || []).length} tareas
                  </span>
                </div>
                <button 
                  type="button"
                  onClick={() => handleAddTask('sundayMonday')}
                  className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Añadir Tarea
                </button>
              </div>

              <div className="p-3 sm:p-4 space-y-3">
                {(localWeek.sundayMonday.tasks || []).map((task, idx) => {
                  const textValue = typeof task === 'object' ? task.text : task;
                  const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                  const locationValue = typeof task === 'object' ? (task.location || '') : '';
                  const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                  const phoneValue = typeof task === 'object' ? (task.phone || '') : '';
                  const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                  const truckValue = typeof task === 'object' ? (task.truck || '') : '';

                  return (
                    <div key={idx} className="flex gap-2.5 items-start bg-slate-900 border border-slate-700 rounded-xl p-3 sm:p-3.5">
                      {/* Reorder Up/Down */}
                      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveTask('sundayMonday', idx, -1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                          title="Subir tarea"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-mono font-bold text-slate-400 select-none">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          disabled={idx === (localWeek.sundayMonday.tasks || []).length - 1}
                          onClick={() => handleMoveTask('sundayMonday', idx, 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all flex items-center justify-center shadow-sm"
                          title="Bajar tarea"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <textarea
                          value={textValue}
                          onChange={(e) => handleTaskChange('sundayMonday', idx, e.target.value)}
                          placeholder="Descripción de la tarea..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-y min-h-[40px]"
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <TimeRangeEditor
                            value={timeValue}
                            onChange={(v) => handleTaskMetadataChange('sundayMonday', idx, 'timeFrame', v)}
                          />
                          <input
                            type="tel"
                            value={phoneValue}
                            onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'phone', e.target.value)}
                            placeholder="Teléfono de contacto"
                            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={locationValue}
                            onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'location', e.target.value)}
                            placeholder="Ubicación / dirección (genera el link de Maps solo)"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                          />
                          {mapsValue && (
                            <a href={mapsValue} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline mt-1 inline-block">
                              📍 Abrir en Google Maps
                            </a>
                          )}
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
                        type="button"
                        onClick={() => handleDeleteTask('sundayMonday', idx)}
                        className="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center mt-1"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Bottom Add Task Button */}
                <button
                  type="button"
                  onClick={() => handleAddTask('sundayMonday')}
                  className="w-full py-2.5 px-3 border border-dashed border-emerald-900/60 hover:border-emerald-500/60 rounded-xl text-xs font-semibold text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/5 transition-all flex items-center justify-center gap-1.5 group mt-1"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>+ Añadir Tarea al final de {localWeek.sundayMonday.title}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800 shrink-0">
          <button 
            onClick={handleSave}
            className="w-full py-3.5 sm:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Guardar y Actualizar Planning
          </button>
        </div>
      </div>
    </div>
  );
}
