import React, { useState } from 'react';
import { Calendar, Plus, X, Copy, Sparkles, RefreshCw, AlertCircle, Check, Truck, Users, PartyPopper } from 'lucide-react';
import { generateScheduleWithGemini, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';

// Asistente guiado para crear una semana nueva: en vez de dejarla en blanco
// (o clonada a ciegas) y que el usuario tenga que organizarla tarea a
// tarea, se le pregunta lo esencial (camiones, quién está disponible,
// cuántas bodas hay el sábado) y con eso se arma un prompt para el mismo
// motor de Gemini que ya usaba el Asistente AI suelto — sustituye al
// formulario simple de antes (solo nombre + fechas + clonar).
export default function WeekManagerModal({ isOpen, onClose, onCreateWeek, currentWeekName, currentWeekTrucks = [], workersList = [] }) {
  const [weekName, setWeekName] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [cloneCurrent, setCloneCurrent] = useState(true);
  const [selectedTrucks, setSelectedTrucks] = useState(() => new Set(currentWeekTrucks.map(t => t.name)));
  const [extraTruck, setExtraTruck] = useState('');
  const [selectedWorkers, setSelectedWorkers] = useState(() => new Set(workersList.map(w => w.name)));
  const [weddingCount, setWeddingCount] = useState(0);
  const [weddingDetails, setWeddingDetails] = useState('');
  const [extraNotes, setExtraNotes] = useState('');
  const [apiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [generatedJson, setGeneratedJson] = useState(null);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setWeekName('');
    setDateRange('');
    setWeddingCount(0);
    setWeddingDetails('');
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

  const buildPrompt = () => {
    const trucks = [...selectedTrucks, ...(extraTruck.trim() ? [extraTruck.trim()] : [])];
    const workers = [...selectedWorkers];
    const parts = [
      `Genera la planificación completa de la semana "${weekName}" (${dateRange}).`,
      trucks.length > 0 ? `Camiones disponibles esta semana: ${trucks.join(', ')}.` : 'No hay camiones marcados como disponibles — avisa en las tareas que dependan de reparto de camión.',
      workers.length > 0 ? `Trabajadores disponibles esta semana: ${workers.join(', ')}.` : '',
      weddingCount > 0
        ? `El sábado hay ${weddingCount} boda${weddingCount === 1 ? '' : 's'} simultánea${weddingCount === 1 ? '' : 's'}${weddingDetails.trim() ? `: ${weddingDetails.trim()}` : ', reparte camiones y personal entre ellas de forma equilibrada'}.`
        : 'El sábado no hay bodas esta semana — no generes saturdaySpecial.weddings, o déjalo vacío.',
      extraNotes.trim() ? `Notas adicionales: ${extraNotes.trim()}` : ''
    ];
    return parts.filter(Boolean).join(' ');
  };

  const handleGenerate = async () => {
    if (!weekName.trim() || !dateRange.trim()) return;
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
      apiKey
    });

    setGeneratedJson(result);
    if (err) setErrorMsg(err);
    setLoading(false);
  };

  const handleApply = () => {
    if (!weekName.trim() || !dateRange.trim() || !generatedJson) return;
    onCreateWeek({ name: weekName.trim(), dateRange: dateRange.trim(), cloneCurrent, aiGeneratedJson: generatedJson });
    resetAndClose();
  };

  const handleSkipAndCreateBlank = () => {
    if (!weekName.trim() || !dateRange.trim()) return;
    onCreateWeek({ name: weekName.trim(), dateRange: dateRange.trim(), cloneCurrent });
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
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <PartyPopper className="w-3.5 h-3.5 text-amber-400" /> ¿Cuántas bodas hay el sábado?
            </label>
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setWeddingCount(c => Math.max(0, c - 1))}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              >
                −
              </button>
              <span className="text-lg font-bold font-mono w-6 text-center">{weddingCount}</span>
              <button
                type="button"
                onClick={() => setWeddingCount(c => Math.min(5, c + 1))}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              >
                +
              </button>
            </div>
            {weddingCount > 0 && (
              <input
                type="text"
                value={weddingDetails}
                onChange={(e) => setWeddingDetails(e.target.value)}
                placeholder="Ubicaciones/detalles si los sabes (ej: Sot de Chera y Mas dels Refranys) — opcional"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
            )}
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
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
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
