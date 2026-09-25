import React, { useState, useEffect, useRef } from 'react';
import { Plus, Copy, Sparkles, RefreshCw, AlertCircle, Check, Truck, Users, PartyPopper, Trash2 } from 'lucide-react';
import { generateScheduleWithGemini, buildWeekPrompt, WEEK_EVENT_DAYS, WEEK_EVENT_KINDS, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';
import Modal from './ui/Modal';
import Tarjeta from './ui/Tarjeta';
import CabeceraModal from './ui/CabeceraModal';
import BotonCerrar from './ui/BotonCerrar';
import { parseWeekRange, getDayLabel } from '../data/taskPlanning';
import { buildEventName } from '../data/eventNaming';
import { AreaTexto, Input, Selector } from './ui/Campo';

// Asistente guiado para crear una semana nueva: en vez de dejarla en blanco
// (o clonada a ciegas) y que el usuario tenga que organizarla tarea a
// tarea, se le pregunta lo esencial (camiones, quién está disponible,
// qué bodas y eventos hay cada día) y con eso se arma un prompt para el mismo
// motor de Gemini que ya usaba el Asistente AI suelto — sustituye al
// formulario simple de antes (solo nombre + fechas + clonar).
export default function WeekManagerModal({ isOpen, onClose, onCreateWeek, onForceAutoDraft, currentWeekName, currentWeekTrucks = [], workersList = [], allWeeks = {} }) {
  const [weekName, setWeekName] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [cloneCurrent, setCloneCurrent] = useState(true);
  const [selectedTrucks, setSelectedTrucks] = useState(() => new Set(currentWeekTrucks.map(t => t.name)));
  const [extraTruck, setExtraTruck] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState(() => new Set(workersList.map(w => w.name)));
  // Bodas y eventos de la semana, uno por fila: { id, day, kind, place, time }.
  const [events, setEvents] = useState([]);
  // Recogidas y devoluciones de alquiler (camiones, generadores...), una por fila: { id, day, text, time }.
  const [rentals, setRentals] = useState([]);
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
  const [calendarLoading, setCalendarLoading] = useState(false);

  // El aviso sale debajo de los botones: en móvil quedaba fuera de pantalla.
  useEffect(() => {
    if (errorMsg) errorRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [errorMsg]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setWeekName('');
    setDateRange('');
    setEvents([]);
    setRentals([]);
    setExtraNotes('');
    setGeneratedJson(null);
    setErrorMsg('');
    setCalendarLoading(false);
    onClose();
  };

  const handleAutoCalendar = async () => {
    if (!onForceAutoDraft) return;
    setCalendarLoading(true);
    setErrorMsg('');
    const res = await onForceAutoDraft();
    setCalendarLoading(false);
    if (!res) {
      setErrorMsg('No se devolvió respuesta del servidor.');
      return;
    }
    if (res.error) {
      setErrorMsg(`Error leyendo el calendario: ${res.error}`);
      return;
    }
    if (res.creadas > 0) {
      // Todo fue bien, cerramos el modal porque ya se han añadido al listado
      resetAndClose();
    } else if (res.omitidas > 0) {
      setErrorMsg(`No se ha creado ningún borrador (se han omitido ${res.omitidas} semanas, seguramente por estar vacías o ya existir). Revisa los avisos principales.`);
    } else {
      setErrorMsg('No se detectaron semanas para crear a partir del calendario.');
    }
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

  const addRental = () => setRentals(prev => [...prev, { id: crypto.randomUUID(), day: 'viernes', text: '', time: '' }]);
  const updateRental = (id, field, value) => setRentals(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
  const removeRental = (id) => setRentals(prev => prev.filter(r => r.id !== id));

  // Con el rango de fechas escrito, los días salen con su número real ("Martes 22").
  const dayLabel = (key) => getDayLabel({ meta: { dateRange } }, key);

  const buildPrompt = () => buildWeekPrompt({
    weekName,
    dateRange,
    trucks: [...selectedTrucks, ...(extraTruck.trim() ? [extraTruck.trim()] : [])],
    workers: [...selectedWorkers],
    events,
    rentals,
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
      eventNames: events.map(e => buildEventName(e, dayLabel)),
      roster: workersList,
      allWeeks
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

  const canGenerate = weekName.trim() && dateRange.trim() && !loading && !calendarLoading;

  return (
    <Modal onCerrar={resetAndClose} ancho="3xl" disposicion="columna" botonCerrar={false}>
      <div className="p-3 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <CabeceraModal
          icono={Sparkles}
          degradado="amber-indigo"
          titulo="Crear Nueva Semana"
          subtitulo="Responde unas preguntas y Gemini AI te arma la planificación"
        />
        <BotonCerrar onClick={resetAndClose} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-7 space-y-5">
        {onForceAutoDraft && (
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 text-sm justify-between shadow-lg shadow-indigo-900/20 backdrop-blur-sm">
            {/* Ambient glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="text-indigo-100 relative z-10">
              <strong className="text-indigo-300 block mb-1 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                ¿Tienes los eventos listos en el Calendario Gula?
              </strong>
              <p className="text-slate-300 text-xs leading-relaxed max-w-xl">
                Puedes generar automáticamente los borradores de las próximas semanas importando todo directamente.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoCalendar}
              disabled={calendarLoading || loading}
              className="relative overflow-hidden group shrink-0 whitespace-nowrap bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2 z-10"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
              {calendarLoading ? <RefreshCw className="w-4 h-4 animate-spin relative z-10" /> : <RefreshCw className="w-4 h-4 relative z-10" />}
              <span className="relative z-10">Generar desde Calendario</span>
            </button>
          </div>
        )}
        
        <div className="relative flex items-center py-3">
            <div className="flex-grow border-t border-slate-800/80 shadow-[0_1px_0_0_rgba(255,255,255,0.02)]"></div>
            <span className="shrink-0 mx-4 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 bg-slate-900/50 px-3 py-1 rounded-full backdrop-blur-sm border border-slate-800/50">O crea una con el Asistente AI</span>
            <div className="flex-grow border-t border-slate-800/80 shadow-[0_1px_0_0_rgba(255,255,255,0.02)]"></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Nombre de la Semana
            </label>
            <Input
              type="text"
              required
              value={weekName}
              onChange={(e) => setWeekName(e.target.value)}
              placeholder="ej. Semana 4"
              acento="amber-suave"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Rango de Fechas
            </label>
            <Input
              type="text"
              required
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              placeholder="ej. Del 22 al 27 de Septiembre"
              acento="amber-suave"
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
                <Truck className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{t.name}
              </button>
            ))}
          </div>
          <Input
            type="text"
            value={extraTruck}
            onChange={(e) => setExtraTruck(e.target.value)}
            placeholder="Otro camión extra esta semana (opcional)"
            tamano="sm" acento="amber-suave"
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
              <Tarjeta key={ev.id} className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Selector
                    id={`ev-day-${ev.id}`}
                    aria-label="Día del evento"
                    value={ev.day}
                    onChange={(e) => updateEvent(ev.id, 'day', e.target.value)}
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0"
                  >
                    {WEEK_EVENT_DAYS.map(d => <option key={d.key} value={d.key}>{dayLabel(d.key)}</option>)}
                  </Selector>
                  <Selector
                    id={`ev-kind-${ev.id}`}
                    aria-label="Tipo de evento"
                    value={ev.kind}
                    onChange={(e) => updateEvent(ev.id, 'kind', e.target.value)}
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0"
                  >
                    {WEEK_EVENT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                  </Selector>
                </div>
                <Input
                  id={`ev-place-${ev.id}`}
                  type="text"
                  value={ev.place}
                  onChange={(e) => updateEvent(ev.id, 'place', e.target.value)}
                  placeholder="Nombre o lugar (ej. Boda Marta — Finca Sur)"
                  tamano="sm" acento="amber-suave" fondo="medio"
                />
                <div className="flex items-center gap-2">
                  <Input
                    id={`ev-time-${ev.id}`}
                    type="text"
                    value={ev.time}
                    onChange={(e) => updateEvent(ev.id, 'time', e.target.value)}
                    placeholder="Horario (ej. 20:30 - 00:30)"
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0 flex-1"
                  />
                  <Input
                    id={`ev-pax-${ev.id}`}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    aria-label="Pax (invitados)"
                    value={ev.pax}
                    onChange={(e) => updateEvent(ev.id, 'pax', e.target.value)}
                    placeholder="Pax"
                    tamano="sm" acento="amber-suave" fondo="medio" className="w-20 shrink-0"
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
              </Tarjeta>
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
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-amber-400" /> ¿Qué recogidas o devoluciones de alquiler hay?
          </label>
          <p className="text-[11px] text-slate-500 mb-2.5">
            Camiones, generadores, material de alquiler... No son eventos, pero hay que planificarlos.
          </p>

          <div className="space-y-2.5">
            {rentals.map(r => (
              <Tarjeta key={r.id} className="p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Selector
                    id={`rt-day-${r.id}`}
                    aria-label="Día de la recogida o devolución"
                    value={r.day}
                    onChange={(e) => updateRental(r.id, 'day', e.target.value)}
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0"
                  >
                    {WEEK_EVENT_DAYS.map(d => <option key={d.key} value={d.key}>{dayLabel(d.key)}</option>)}
                  </Selector>
                  <Input
                    id={`rt-time-${r.id}`}
                    type="text"
                    aria-label="Hora de la recogida o devolución"
                    value={r.time}
                    onChange={(e) => updateRental(r.id, 'time', e.target.value)}
                    placeholder="Hora (ej. 18:00)"
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    id={`rt-text-${r.id}`}
                    type="text"
                    aria-label="Qué hay que recoger o devolver"
                    value={r.text}
                    onChange={(e) => updateRental(r.id, 'text', e.target.value)}
                    placeholder="Qué (ej. Recoger generadores 7K y furgo Albacar)"
                    tamano="sm" acento="amber-suave" fondo="medio" className="min-w-0 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => removeRental(r.id)}
                    aria-label="Quitar esta recogida o devolución"
                    className="shrink-0 p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Tarjeta>
            ))}
          </div>

          <button
            type="button"
            onClick={addRental}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-dashed border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Añadir recogida o devolución
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Notas adicionales (opcional)
          </label>
          <AreaTexto
            rows={2}
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            placeholder="Cualquier cosa especial a tener en cuenta esta semana..."
            tamano="md" redondeo="2xl" acento="amber-suave"
          />
        </div>

        <div>
          {showKeyInput ? (
            <>
              <label htmlFor="gemini-key" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Clave de Gemini (necesaria para generar)
              </label>
              <Input
                id="gemini-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                tamano="sm" acento="amber-suave"
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
            className="group relative overflow-hidden flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:opacity-95 text-slate-950 text-sm font-extrabold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:hover:scale-100"
          >
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin relative z-10" />
                <span className="relative z-10 tracking-wide">Generando Planificación con Gemini AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 relative z-10" />
                <span className="relative z-10 tracking-wide">Generar Planificación Inteligente</span>
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
              className="group relative overflow-hidden w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-sm font-extrabold shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center space-x-2"
            >
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent group-hover:animate-[shimmer_1.5s_infinite]"></div>
              <Plus className="w-5 h-5 relative z-10" />
              <span className="relative z-10 tracking-wide">Crear la Semana con esta Planificación</span>
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
