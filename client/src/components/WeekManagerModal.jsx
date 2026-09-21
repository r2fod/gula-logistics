import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, X, Copy, Sparkles, RefreshCw, AlertCircle, Check, Truck, Users, PartyPopper, Trash2 } from 'lucide-react';
import { generateScheduleWithGemini, buildWeekPrompt, WEEK_EVENT_DAYS, WEEK_EVENT_KINDS, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { parseWeekRange, getDayLabel } from '../data/taskPlanning';
import { buildEventName } from '../data/eventNaming';

// Asistente guiado para crear una semana nueva: en vez de dejarla en blanco
// (o clonada a ciegas) y que el usuario tenga que organizarla tarea a
// tarea, se le pregunta lo esencial (camiones, quién está disponible,
// qué bodas y eventos hay cada día) y con eso se arma un prompt para el mismo
// motor de Gemini que ya usaba el Asistente AI suelto — sustituye al
// formulario simple de antes (solo nombre + fechas + clonar).
export default function WeekManagerModal({ isOpen, onClose, onCreateWeek, currentWeekName, currentWeekTrucks = [], workersList = [] }) {
  const [weekName, setWeekName] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [cloneCurrent, setCloneCurrent] = useState(true);
  const [selectedTrucks, setSelectedTrucks] = useState(() => new Set(currentWeekTrucks.map(t => t.name)));
  const [extraTruck, setExtraTruck] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState(() => new Set(workersList.map(w => w.name)));
  // Bodas y eventos de la semana, uno por fila: { id, day, kind, place, time }.
  const [events, setEvents] = useState([]);
  const [extraNotes, setExtraNotes] = useState('');
  // La clave de Gemini se guarda solo en este navegador (nunca en el código):
  // cada móvil/ordenador la necesita pegada una vez. Sin ella no se puede
  // generar (antes se enseñaba una demo con datos de otra semana).
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
  const [showKeyInput, setShowKeyInput] = useState(() => !localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY));
  const errorRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedJson, setGeneratedJson] = useState(null);

  useBodyScrollLock(isOpen);

  // El aviso sale debajo de los botones: en móvil quedaba fuera de pantalla.
  useEffect(() => {
    if (errorMsg) errorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [errorMsg]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setWeekName('');
    setDateRange('');
    setEvents([]);
    setExtraNotes('');
    setGeneratedJson(null);
    setErrorMsg('');
    onClose();
  };

  const toggleTruck = (name) => {
    setSelectedTrucks(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleWorker = (name) => {
    setSelectedWorkers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const addEvent = () => {
    // El día por defecto es el sábado (el caso más habitual) pero se cambia en el selector.
    setEvents(prev => [...prev, { id: crypto.randomUUID(), day: 'sabado', kind: 'Boda', place: '', time: '', pax: '' }]);
  };
  const updateEvent = (id, field, value) => setEvents(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  const removeEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id));

  // Con el rango de fechas escrito, los días salen con su número real ("Martes 22").
  const dayLabel = (key) => getDayLabel({ meta: { dateRange } }, key);

  const buildPrompt = () => buildWeekPrompt({
    weekName,
    dateRange,
    trucks: [...selectedTrucks, ...(extraTruck.trim() ? [extraTruck.trim()] : [])],
    workers: [...selectedWorkers],
    events,
    extraNotes,
    dayLabel,
  });

  const handleGenerate = async () => {
    if (!weekName.trim() || !dateRange.trim()) return;
    if (apiKey.trim()) {
      try { localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey.trim()); } catch { /* sin almacenamiento: se usa solo esta vez */ }
    }
    setLoading(true);
    setErrorMsg('');
    setGeneratedJson(null);

    // A diferencia del Asistente AI suelto (que SÍ pasa la semana activa
    // para que Gemini la modifique), aquí se genera siempre desde cero: es
    // una semana nueva, no tiene sentido que Gemini reutilice o intente
    // "actualizar" las tareas de la semana vieja — eso es justo lo que
    // haría si se le pasara activeWeekData con contenido real.
    const { generatedJson: result, errorMsg: err } = await generateScheduleWithGemini({
      prompt: buildPrompt(),
      apiKey,
      eventNames: events.map(e => buildEventName(e, dayLabel))
    });

    setGeneratedJson(result);
    if (err) setErrorMsg(err);
    setLoading(false);
  };

  // Bodas y eventos con sus pax, para repartir el coste de las tareas
  // compartidas entre eventos en proporción a su tamaño.
  const weekEvents = () => events.map(e => ({ name: buildEventName(e, dayLabel), pax: Number(e.pax) > 0 ? Math.round(Number(e.pax)) : null }));

  const handleApply = () => {
    if (!weekName.trim() || !dateRange.trim() || !generatedJson) return;
    onCreateWeek({ name: weekName.trim(), dateRange: dateRange.trim(), cloneCurrent, aiGeneratedJson: generatedJson, events: weekEvents() });
    resetAndClose();
  };

  const handleSkipAndCreateBlank = () => {
    if (!weekName.trim() || !dateRange.trim()) return;
    onCreateWeek({ name: weekName.trim(), dateRange: dateRange.trim(), cloneCurrent, events: weekEvents() });
    resetAndClose();
  };

  const canGenerate = weekName.trim() && dateRange.trim() && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl text-white max-h-[96vh] overflow-y-auto">
        <button
          onClick={resetAndClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-bold font-['Outfit']">Crear Nueva Semana</h3>
            <p className="text-xs text-slate-400">Responde unas preguntas y Gemini AI te arma la planificación</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nombre de la Semana
              </label>
              <input
                type="text"
                required
                value={weekName}
                onChange={(e) => setWeekName(e.target.value)}
                placeholder="ej. Semana 4"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Rango de Fechas
              </label>
              <input
                type="text"
                required
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                placeholder="ej. Del 22 al 27 de Septiembre"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              {/* El marcado automático de tareas (y los números de día) salen de este texto. */}
              {dateRange.trim() && !parseWeekRange(dateRange) && (
                <p className="mt-1.5 text-[11px] text-amber-400">
                  No entiendo estas fechas: sin ellas las tareas no se marcarán solas por horario. Usa el formato "Del 22 al 27 de Septiembre".
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="cloneCurrent"
              checked={cloneCurrent}
              onChange={(e) => setCloneCurrent(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="cloneCurrent" className="text-xs text-slate-300 flex items-center space-x-1 cursor-pointer">
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Partir del equipo/camiones ya dados de alta en la semana actual ({currentWeekName})</span>
            </label>
          </div>

          <div className="border-t border-slate-800 pt-5">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-amber-400" /> ¿Qué camiones tienes disponibles?
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {currentWeekTrucks.map(t => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => toggleTruck(t.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedTrucks.has(t.name)
                      ? 'bg-amber-500 border-amber-500 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🚚 {t.name}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={extraTruck}
              onChange={(e) => setExtraTruck(e.target.value)}
              placeholder="Otro camión extra esta semana (opcional)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" /> ¿Quién está disponible esta semana?
            </label>
            <div className="flex flex-wrap gap-2">
              {workersList.map(w => (
                <button
                  key={w.name}
                  type="button"
                  onClick={() => toggleWorker(w.name)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    selectedWorkers.has(w.name)
                      ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {w.avatar || '👤'} {w.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <PartyPopper className="w-3.5 h-3.5 text-amber-400" /> ¿Qué bodas y eventos hay esta semana?
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Añade cada uno con su día y sus pax (invitados): la IA planifica la carga, la ruta, el montaje y la recogida de todos, y los costes de una tarea compartida se reparten por pax.
            </p>

            <div className="space-y-2.5">
              {events.map(ev => (
                <div key={ev.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      id={`ev-day-${ev.id}`}
                      aria-label="Día del evento"
                      value={ev.day}
                      onChange={(e) => updateEvent(ev.id, 'day', e.target.value)}
                      className="min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                    >
                      {WEEK_EVENT_DAYS.map(d => <option key={d.key} value={d.key}>{dayLabel(d.key)}</option>)}
                    </select>
                    <select
                      id={`ev-kind-${ev.id}`}
                      aria-label="Tipo de evento"
                      value={ev.kind}
                      onChange={(e) => updateEvent(ev.id, 'kind', e.target.value)}
                      className="min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/60"
                    >
                      {WEEK_EVENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                  <input
                    id={`ev-place-${ev.id}`}
                    type="text"
                    value={ev.place}
                    onChange={(e) => updateEvent(ev.id, 'place', e.target.value)}
                    placeholder="Nombre o lugar (ej. Boda Rocío — Mas dels Refranys)"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id={`ev-time-${ev.id}`}
                      type="text"
                      value={ev.time}
                      onChange={(e) => updateEvent(ev.id, 'time', e.target.value)}
                      placeholder="Horario (ej. 20:30 - 00:30)"
                      className="min-w-0 flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                    <input
                      id={`ev-pax-${ev.id}`}
                      type="number"
                      inputMode="numeric"
                      min="0"
                      aria-label="Pax (invitados)"
                      value={ev.pax}
                      onChange={(e) => updateEvent(ev.id, 'pax', e.target.value)}
                      placeholder="Pax"
                      className="w-20 shrink-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvent(ev.id)}
                      aria-label="Quitar este evento"
                      className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addEvent}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir boda o evento
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Notas adicionales (opcional)
            </label>
            <textarea
              rows={2}
              value={extraNotes}
              onChange={(e) => setExtraNotes(e.target.value)}
              placeholder="Cualquier cosa especial a tener en cuenta esta semana..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          <div>
            {showKeyInput ? (
              <>
                <label htmlFor="gemini-key" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Clave de Gemini (necesaria para generar)
                </label>
                <input
                  id="gemini-key"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Se guarda solo en este navegador. Si no la tienes, se crea gratis en aistudio.google.com/apikey.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-emerald-400 flex items-center gap-2">
                <Check className="w-3.5 h-3.5" /> Clave de Gemini guardada en este dispositivo.
                <button type="button" onClick={() => setShowKeyInput(true)} className="underline text-slate-400 hover:text-slate-200">Cambiar</button>
              </p>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-indigo-500 hover:opacity-95 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generando Planificación con Gemini AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generar Planificación Inteligente</span>
                </>
              )}
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <button type="button" onClick={handleSkipAndCreateBlank} disabled={!weekName.trim() || !dateRange.trim()} className="underline hover:text-slate-300 disabled:opacity-40 disabled:no-underline">
              Prefiero saltarme esto y crearla en blanco
            </button>
            <button type="button" onClick={resetAndClose} className="hover:text-slate-300">
              Cancelar
            </button>
          </div>

          {errorMsg && (
            <div ref={errorRef} role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {generatedJson && (
            <div className="space-y-4 border-t border-slate-800 pt-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-amber-400 flex items-center space-x-1.5">
                  <Check className="w-4 h-4" />
                  <span>Planificación Generada — revísala antes de crear la semana</span>
                </h4>
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs space-y-3 max-h-60 overflow-y-auto">
                {generatedJson.saturdaySpecial?.weddings?.length > 0 && (
                  <>
                    <div className="font-bold text-white">{generatedJson.saturdaySpecial?.title}</div>
                    <ul className="space-y-1.5 text-slate-300">
                      {generatedJson.saturdaySpecial.weddings.map((w, idx) => (
                        <li key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="font-bold text-amber-300">{w.location}</span> ({w.truck}) - {w.details}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {Object.entries(generatedJson.schedule || {}).map(([dayKey, day]) => (
                  <div key={dayKey}>
                    <div className="font-bold text-white">{day.title}</div>
                    <ul className="space-y-1 text-slate-300 mt-1">
                      {(day.tasks || []).map((t, idx) => (
                        <li key={idx} className="text-slate-400">• {t.text} <span className="text-slate-500">({t.timeFrame})</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <button
                onClick={handleApply}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Crear la Semana con esta Planificación</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
