import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, ChevronUp, Edit3, MapPin, Plus, Save, Trash2, Users, Eye, EyeOff } from 'lucide-react';
import { getTaskListForDay, buildTaskListPatch } from '../data/taskPlanning';
import { collectEventNames, splitEventNames, parseEventAndTask, EVENT_CATEGORIES } from '../data/eventNaming';
import Modal from './ui/Modal';
import SelectorPosicion from './ui/SelectorPosicion';
import CabeceraModal from './ui/CabeceraModal';
import BotonCerrar from './ui/BotonCerrar';
import Boton from './ui/Boton';
import { Campo, Input, Selector, AreaTexto } from './ui/Campo';

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
        <Input
          type="time"
          value={start}
          disabled={pending}
          onChange={(e) => onChange(formatTimeFrame(e.target.value, end))}
          tamano="xs" texto="suave" className="flex-1 min-w-0 disabled:opacity-40 [color-scheme:dark]"
        />
        <span className="text-slate-500 text-[11px] shrink-0">a</span>
        <Input
          type="time"
          value={end}
          disabled={pending}
          onChange={(e) => onChange(formatTimeFrame(start, e.target.value))}
          tamano="xs" texto="suave" className="flex-1 min-w-0 disabled:opacity-40 [color-scheme:dark]"
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

export default function AdminTaskEditorModal({ isOpen, onClose, activeWeekData, workersList = [], onSaveWeekData, onJumpToVispera }) {
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

  // Estas cinco funciones manejaban por separado "sundayMonday" (domingo Y
  // lunes comparten una sola lista, bajo weekData.sundayMonday.tasks) frente
  // a un día normal (weekData.schedule[dayKey].tasks) — la misma lógica
  // duplicada dos veces por función. Ahora usan getTaskListForDay/
  // buildTaskListPatch de taskPlanning.js, la única fuente de verdad para
  // ese caso especial en toda la app (ver el comentario de ese archivo).
  const handleTaskChange = (dayKey, taskIndex, newValue) => {
    setLocalWeek(prev => {
      const list = [...getTaskListForDay(prev, dayKey)];
      const task = list[taskIndex];
      list[taskIndex] = typeof task === 'string'
        ? { text: newValue, timeFrame: '', mapsUrl: '' }
        : { ...task, text: newValue };
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  // Pax (invitados) de cada boda/evento de la semana: reparten el coste de las
  // tareas que son de varios eventos. Se guardan en `localWeek.events`.
  const setEventPax = (name, value) => {
    const pax = value === '' ? null : Math.max(0, Math.round(Number(value)) || 0);
    setLocalWeek(prev => {
      const others = (prev.events || []).filter(e => String(e.name).toLowerCase() !== name.toLowerCase());
      return { ...prev, events: pax ? [...others, { name, pax }] : others };
    });
  };

  // Escribir el nombre/dirección del sitio genera el link de Google Maps
  // solo — ya no hace falta copiar y pegar la URL a mano.
  const buildMapsUrl = (place) => place
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    : '';

  const handleTaskMetadataChange = (dayKey, taskIndex, field, newValue) => {
    setLocalWeek(prev => {
      const list = [...getTaskListForDay(prev, dayKey)];
      const task = list[taskIndex];
      const nextTask = typeof task === 'string' ? { text: task } : { ...task };
      nextTask[field] = newValue;
      if (field === 'location') {
        nextTask.mapsUrl = buildMapsUrl(newValue);
      }
      list[taskIndex] = nextTask;
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  const handleAddTask = (dayKey) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const newTask = { text: "Nueva Tarea", timeFrame: "", mapsUrl: "", location: "", phone: "", truck: "", assigned: [] };
      const list = [...getTaskListForDay(prev, dayKey), newTask];
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  const handleDeleteTask = (dayKey, taskIndex) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const list = [...getTaskListForDay(prev, dayKey)];
      list.splice(taskIndex, 1);
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  const handleMoveTask = (dayKey, taskIndex, direction) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const list = [...getTaskListForDay(prev, dayKey)];
      const targetIndex = taskIndex + direction;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;
      const [moved] = list.splice(taskIndex, 1);
      list.splice(targetIndex, 0, moved);
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  const handleMoveTaskTo = (dayKey, taskIndex, targetIndex) => {
    setLocalWeek(prev => {
      if (!prev) return prev;
      const list = [...getTaskListForDay(prev, dayKey)];
      if (targetIndex < 0 || targetIndex >= list.length || targetIndex === taskIndex) return prev;
      const [moved] = list.splice(taskIndex, 1);
      list.splice(targetIndex, 0, moved);
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
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

  const handleMoveWeddingTo = (weddingIndex, targetIndex) => {
    setLocalWeek(prev => {
      if (!prev?.saturdaySpecial?.weddings) return prev;
      const weddings = [...prev.saturdaySpecial.weddings];
      if (targetIndex < 0 || targetIndex >= weddings.length || targetIndex === weddingIndex) return prev;
      const [moved] = weddings.splice(weddingIndex, 1);
      weddings.splice(targetIndex, 0, moved);
      return {
        ...prev,
        saturdaySpecial: { ...prev.saturdaySpecial, weddings }
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
    setLocalWeek(prev => {
      const list = [...getTaskListForDay(prev, dayKey)];
      const task = list[taskIndex];
      const current = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
      const next = current.includes(workerName) ? current.filter(n => n !== workerName) : [...current, workerName];
      list[taskIndex] = typeof task === 'string' ? { text: task, assigned: next } : { ...task, assigned: next };
      return { ...prev, ...buildTaskListPatch(prev, dayKey, list) };
    });
  };

  const toggleAssignedWedding = (weddingIndex, workerName) => {
    const updated = { ...localWeek };
    const wedding = updated.saturdaySpecial.weddings[weddingIndex];
    const current = Array.isArray(wedding.assigned) ? wedding.assigned : [];
    wedding.assigned = current.includes(workerName) ? current.filter(n => n !== workerName) : [...current, workerName];
    setLocalWeek(updated);
  };

  const AssignedPicker = ({ assigned = [], onToggle }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {workersList.map(w => {
        const isChecked = assigned.includes(w.name);
        return (
          <button
            key={w.name}
            type="button"
            onClick={() => onToggle(w.name)}
            className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-1.5 sm:px-2 sm:py-2 rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
              isChecked
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/10'
                : 'bg-slate-950 text-slate-400 border-slate-700/60 hover:border-slate-500 hover:bg-slate-900'
            }`}
          >
            <span className="shrink-0">{w.avatar}</span>
            <span className="truncate">{w.name}</span>
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
    <Modal onCerrar={onClose} ancho="6xl" disposicion="columna" botonCerrar={false}>
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
        <CabeceraModal
          icono={Edit3}
          degradado="amber-orange"
          compacta
          titulo="Editor Manual del Planning"
          subtitulo={`Modificando: ${localWeek.name || 'Semana'}`}
        />
        <BotonCerrar onClick={onClose} />
      </div>

      {/* Quick Day Jump Ribbon with Illuminated Active Day */}
      <div className="bg-slate-950/95 backdrop-blur-md px-3 sm:px-6 py-2.5 border-b border-slate-800 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar shrink-0">
        <span className="text-[10px] uppercase font-black text-amber-400 whitespace-nowrap mr-1 flex items-center gap-1">
          <span>📍</span>
          <span>Ir a:</span>
        </span>
        {onJumpToVispera && (
          <button
            type="button"
            onClick={onJumpToVispera}
            className="px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap capitalize flex items-center gap-1.5 border bg-indigo-950/30 hover:bg-indigo-950/60 text-indigo-300 border-indigo-900/40 active:scale-95"
            title="Ir a editar la víspera (lunes) que está guardada en la semana anterior"
          >
            <span>Lunes (Víspera) ⏪</span>
          </button>
        )}
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
        {/* Pax por evento: reparten el coste de las tareas compartidas entre eventos */}
        {(() => {
          const eventos = collectEventNames(localWeek).filter(n => !EVENT_CATEGORIES.includes(n));
          if (eventos.length === 0) return null;
          return (
            <details className="bg-slate-950/50 rounded-2xl border border-slate-800 mt-3">
              <summary className="cursor-pointer px-4 py-3 text-xs font-extrabold text-amber-300">
                <Users className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Pax por boda/evento (para repartir costes)
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-[11px] text-slate-500">
                  Una tarea de varios eventos reparte su coste en proporción a estos pax. Si a alguno le falta, se reparte a partes iguales.
                </p>
                {eventos.map(nombre => {
                  const actual = (localWeek.events || []).find(e => String(e.name).toLowerCase() === nombre.toLowerCase());
                  return (
                    <div key={nombre} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-200">{nombre}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        aria-label={`Pax de ${nombre}`}
                        value={actual?.pax ?? ''}
                        onChange={(e) => setEventPax(nombre, e.target.value)}
                        placeholder="Pax"
                        tamano="2xs" redondeo="lg" className="w-24 shrink-0"
                      />
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })()}
        
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
              
              <div className="p-2 sm:p-4 space-y-3">
                {currentTasks.map((task, idx) => {
                  const textValue = typeof task === 'object' ? task.text : task;
                  const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                  const locationValue = typeof task === 'object' ? (task.location || '') : '';
                  const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                  const phoneValue = typeof task === 'object' ? (task.phone || '') : '';
                  const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                  const truckValue = typeof task === 'object' ? (task.truck || '') : '';
                  const isActiveTask = typeof task === 'object' && task.active !== false;

                  return (
                    <div 
                      key={idx} 
                      className={`relative bg-slate-900/50 p-4 sm:p-5 rounded-2xl border transition-all ${
                        isActiveTask ? 'border-slate-700 hover:border-slate-600' : 'border-slate-800 opacity-50 grayscale hover:grayscale-0'
                      }`}
                    >
                      <div className="absolute top-2 right-2 flex flex-col items-center gap-1">
                        <SelectorPosicion 
                          currentIndex={idx} 
                          totalItems={currentTasks.length} 
                          onChange={(targetIndex) => handleMoveTaskTo(dayKey, idx, targetIndex)}
                        />
                      </div>
                      <div className="mb-4 pr-16 flex items-center gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Event / Task Split Inputs */}
                        {(() => {
                          let eventName = '';
                          let specificTask = textValue;
                          if (textValue && textValue.includes(' - ')) {
                            const parts = textValue.split(' - ');
                            eventName = parts[0];
                            specificTask = parts.slice(1).join(' - ');
                          }

                          // Tarea de una semana anterior al formato "Evento - Tarea" que ya lleva su
                          // evento en el campo `event` (sin él en el texto): el evento se edita EN ESE
                          // CAMPO y el texto no se toca. Los fichajes ya hechos guardan el texto tal
                          // cual, así que reescribirlo (poniéndole "Evento - " delante) los desligaba
                          // de la tarea y de su evento.
                          const modoCampo = typeof task === 'object' && task !== null && !parseEventAndTask(textValue || '').explicit
                            && typeof task.event === 'string'; // aunque se vacíe: sigue siendo una tarea de "campo"
                          if (modoCampo) eventName = task.event;

                          const handleSplitChange = (newEv, newTk) => {
                            if (modoCampo) {
                              if (newTk !== textValue) handleTaskChange(dayKey, idx, newTk);
                              if (newEv !== eventName) handleTaskMetadataChange(dayKey, idx, 'event', newEv);
                              return;
                            }
                            const combined = newEv.trim() ? `${newEv} - ${newTk}` : newTk;
                            handleTaskChange(dayKey, idx, combined);
                          };

                          // Una tarea puede ser de varios eventos: se guardan unidos con " + "
                          // ("Boda A + Boda B") y su coste se reparte entre ellos. Los chips
                          // son un atajo: tocar uno lo añade o lo quita de la tarea.
                          const selectedEvents = splitEventNames(eventName);
                          const eventChips = [...new Set([...collectEventNames(localWeek), ...selectedEvents])];
                          const toggleEvent = (name) => {
                            const next = selectedEvents.includes(name) ? selectedEvents.filter(n => n !== name) : [...selectedEvents, name];
                            handleSplitChange(next.join(' + '), specificTask);
                          };

                          return (
                            <div className="flex flex-col gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Evento (Ej: Boda Soto) — si es de varios, sepáralos con +</label>
                                <div className="relative">
                                  <div className="flex flex-nowrap overflow-x-auto gap-2 mb-2 w-full pb-2 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
                                    {eventChips.map(name => {
                                      const on = selectedEvents.includes(name);
                                      return (
                                        <button
                                          key={name}
                                          type="button"
                                          aria-pressed={on}
                                          onClick={() => toggleEvent(name)}
                                          className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-bold border transition-colors snap-start ${
                                            on ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/20' : 'bg-slate-900/80 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800'
                                          }`}
                                        >
                                          {name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {/* Right fade gradient to indicate scroll */}
                                  <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-slate-950 to-transparent pointer-events-none rounded-r-lg"></div>
                                </div>
                                <Input
                                  type="text"
                                  value={eventName}
                                  onChange={(e) => handleSplitChange(e.target.value, specificTask)}
                                  placeholder="Dejar vacío si es una Tarea General"
                                  tamano="sm" redondeo="lg" texto="destacado"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Descripción de la Tarea Específica</label>
                                <AreaTexto
                                  rows={2}
                                  value={specificTask}
                                  onChange={(e) => handleSplitChange(eventName, e.target.value)}
                                  placeholder="Ej: Carga de camión y montaje de carpas..."
                                  tamano="sm" redondeo="lg" texto="suave" className="w-full resize-y min-h-[60px]"
                                />
                              </div>
                            </div>
                          );
                        })()}
                        <div className="flex flex-col sm:flex-row gap-2">
                          <TimeRangeEditor
                            value={timeValue}
                            onChange={(v) => handleTaskMetadataChange(dayKey, idx, 'timeFrame', v)}
                          />
                          <Input
                            type="tel"
                            value={phoneValue}
                            onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'phone', e.target.value)}
                            placeholder="Teléfono de contacto"
                            tamano="xs" texto="suave" className="flex-1 min-w-0"
                          />
                        </div>
                        <div>
                          <Input
                            type="text"
                            value={locationValue}
                            onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'location', e.target.value)}
                            placeholder="Ubicación / dirección (genera el link de Maps solo)"
                            tamano="xs" acento="blue" texto="suave"
                          />
                          {mapsValue && (
                            <a href={mapsValue} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline mt-1 inline-block">
                              <MapPin className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />Abrir en Google Maps
                            </a>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                          <Selector
                            value={truckValue}
                            onChange={(e) => handleTaskMetadataChange(dayKey, idx, 'truck', e.target.value)}
                            tamano="xs" texto="suave"
                          >
                            <option value="">Sin camión / no aplica</option>
                            <option value="Camión Gula">Camión Gula</option>
                            <option value="Camión Covey">Camión Covey</option>
                            <option value="Camión Albacar">Camión Albacar</option>
                          </Selector>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                          <AssignedPicker
                            assigned={assignedValue}
                            onToggle={(workerName) => toggleAssignedWorker(dayKey, idx, workerName)}
                          />
                        </div>
                      </div>

                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => handleTaskMetadataChange(dayKey, idx, 'active', !isActiveTask)}
                          className={`p-1.5 flex-1 rounded-xl border transition-colors flex items-center justify-center gap-1.5 text-xs font-bold ${
                            isActiveTask 
                              ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          }`}
                        >
                          {isActiveTask ? (
                            <><EyeOff className="w-4 h-4" /> <span>Desactivar</span></>
                          ) : (
                            <><Eye className="w-4 h-4" /> <span>Activar</span></>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteTask(dayKey, idx)}
                          className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors flex items-center justify-center"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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

            <div className="p-2 sm:p-4 space-y-3">
              {(localWeek.saturdaySpecial.weddings || []).map((w, idx) => {
                const isActiveWedding = w.active !== false;
                return (
                <div key={idx} className={`relative bg-slate-900 border rounded-xl p-2 sm:p-3 transition-all ${
                  isActiveWedding ? 'border-slate-800' : 'border-slate-800 opacity-50 grayscale hover:grayscale-0'
                }`}>
                  <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-10">
                    <SelectorPosicion 
                      currentIndex={idx} 
                      totalItems={(localWeek.saturdaySpecial.weddings || []).length} 
                      onChange={(targetIndex) => handleMoveWeddingTo(idx, targetIndex)}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-3 pr-14">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Ubicación / Finca</label>
                        <Input 
                          type="text" 
                          value={w.location} 
                          onChange={(e) => handleWeddingChange(idx, 'location', e.target.value)}
                          tamano="xs" acento="rose" borde="marcado"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                        <Input 
                          type="text" 
                          value={w.truck} 
                          onChange={(e) => handleWeddingChange(idx, 'truck', e.target.value)}
                          tamano="xs" acento="rose" borde="marcado"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Logística (Asignados / Notas)</label>
                      <Input 
                        type="text" 
                        value={w.details} 
                        onChange={(e) => handleWeddingChange(idx, 'details', e.target.value)}
                        tamano="xs" acento="rose" borde="marcado"
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
                        <Input
                          type="tel"
                          value={w.phone || ''}
                          onChange={(e) => handleWeddingChange(idx, 'phone', e.target.value)}
                          tamano="xs" acento="rose" borde="marcado"
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


                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleWeddingChange(idx, 'active', !isActiveWedding)}
                      className={`p-1.5 flex-1 rounded-xl border transition-colors flex items-center justify-center gap-1.5 text-xs font-bold ${
                        isActiveWedding 
                          ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      }`}
                    >
                      {isActiveWedding ? (
                        <><EyeOff className="w-4 h-4" /> <span>Desactivar</span></>
                      ) : (
                        <><Eye className="w-4 h-4" /> <span>Activar</span></>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWedding(idx)}
                      className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center"
                      title="Eliminar evento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
              })}

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

            <div className="p-2 sm:p-4 space-y-3">
              {(localWeek.sundayMonday.tasks || []).map((task, idx) => {
                const textValue = typeof task === 'object' ? task.text : task;
                const timeValue = typeof task === 'object' ? (task.timeFrame || '') : '';
                const locationValue = typeof task === 'object' ? (task.location || '') : '';
                const mapsValue = typeof task === 'object' ? (task.mapsUrl || '') : '';
                const phoneValue = typeof task === 'object' ? (task.phone || '') : '';
                const assignedValue = (typeof task === 'object' && Array.isArray(task.assigned)) ? task.assigned : [];
                const truckValue = typeof task === 'object' ? (task.truck || '') : '';
                const targetDayValue = typeof task === 'object' ? (task.targetDay || '') : '';
                const isActiveTask = typeof task === 'object' && task.active !== false;

                return (
                  <div key={idx} className={`relative bg-slate-900 border rounded-xl p-2 sm:p-3 transition-all ${
                    isActiveTask ? 'border-slate-700' : 'border-slate-800 opacity-50 grayscale hover:grayscale-0'
                  }`}>
                    <div className="absolute top-2 right-2 flex flex-col items-center gap-1 z-10">
                      <SelectorPosicion 
                        currentIndex={idx} 
                        totalItems={(localWeek.sundayMonday.tasks || []).length} 
                        onChange={(targetIndex) => handleMoveTaskTo('sundayMonday', idx, targetIndex)}
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2 pr-14">
                      <AreaTexto
                        rows={3}
                        value={textValue}
                        onChange={(e) => handleTaskChange('sundayMonday', idx, e.target.value)}
                        placeholder="Descripción de la tarea..."
                        tamano="sm" redondeo="lg" acento="emerald" texto="suave" className="w-full resize-y min-h-[80px]"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <TimeRangeEditor
                          value={timeValue}
                          onChange={(v) => handleTaskMetadataChange('sundayMonday', idx, 'timeFrame', v)}
                        />
                        <Input
                          type="tel"
                          value={phoneValue}
                          onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'phone', e.target.value)}
                          placeholder="Teléfono de contacto"
                          tamano="xs" acento="emerald" texto="suave" className="flex-1 min-w-0"
                        />
                      </div>
                      <div>
                        <Input
                          type="text"
                          value={locationValue}
                          onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'location', e.target.value)}
                          placeholder="Ubicación / dirección (genera el link de Maps solo)"
                          tamano="xs" acento="blue" texto="suave"
                        />
                        {mapsValue && (
                          <a href={mapsValue} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline mt-1 inline-block">
                            📍 Abrir en Google Maps
                          </a>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Camión</label>
                          <Selector
                            value={truckValue}
                            onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'truck', e.target.value)}
                            tamano="xs" acento="emerald" texto="suave"
                          >
                            <option value="">Sin camión / no aplica</option>
                            <option value="Camión Gula">Camión Gula</option>
                            <option value="Camión Covey">Camión Covey</option>
                            <option value="Camión Albacar">Camión Albacar</option>
                          </Selector>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Día Específico</label>
                          <Selector
                            value={targetDayValue}
                            onChange={(e) => handleTaskMetadataChange('sundayMonday', idx, 'targetDay', e.target.value)}
                            tamano="xs" acento="emerald" texto="suave"
                          >
                            <option value="">Domingo o Lunes (Indiferente)</option>
                            <option value="Domingo">Solo Domingo</option>
                            <option value="Lunes">Solo Lunes</option>
                          </Selector>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold mb-1 block">Asignar a</label>
                        <AssignedPicker
                          assigned={assignedValue}
                          onToggle={(workerName) => toggleAssignedWorker('sundayMonday', idx, workerName)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => handleTaskMetadataChange('sundayMonday', idx, 'active', !isActiveTask)}
                        className={`p-1.5 flex-1 rounded-xl border transition-colors flex items-center justify-center gap-1.5 text-xs font-bold ${
                          isActiveTask 
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                        }`}
                      >
                        {isActiveTask ? (
                          <><EyeOff className="w-4 h-4" /> <span>Desactivar</span></>
                        ) : (
                          <><Eye className="w-4 h-4" /> <span>Activar</span></>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteTask('sundayMonday', idx)}
                        className="p-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-colors shrink-0 flex items-center justify-center"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
      <div className="p-4 sm:p-6 border-t border-slate-800/60 bg-slate-900/50 backdrop-blur-md shrink-0 rounded-b-2xl">
        <button 
          type="button"
          onClick={handleSave}
          className="w-full relative overflow-hidden group flex items-center justify-center gap-2 px-6 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm sm:text-base shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {/* Subtle sheen effect */}
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
          <Save className="w-5 h-5 relative z-10" />
          <span className="relative z-10">Guardar y Actualizar Planning</span>
        </button>
      </div>
    </Modal>
  );
}
