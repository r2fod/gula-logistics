import React, { useState } from 'react';
import { Sparkles, Check, AlertCircle, RefreshCw, Key, Wand2, BrainCircuit, X } from 'lucide-react';
import { generateScheduleWithGemini, extraerMemoriaDelPrompt, GEMINI_API_KEY_STORAGE_KEY } from '../data/geminiScheduleService';
import { useMemoriaIa } from '../hooks/useMemoriaIa';
import { diffSemana, avisosDeSemana } from '../data/diffSemana';
import CambiosPropuestos from './asistente/CambiosPropuestos';
import Modal from './ui/Modal';
import CabeceraModal from './ui/CabeceraModal';
import { Campo, Input, AreaTexto } from './ui/Campo';

// `aprendizaje` (App, aprenderDeFichajes): lo que se sabe de los fichajes reales,
// que Gemini recibe junto con las reglas activas de la memoria.
export default function GeminiAssistantModal({ isOpen, onClose, onApplyGeneratedSchedule, activeWeekData, workersList = [], aprendizaje = null }) {
  const [prompt, setPrompt] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedJson, setGeneratedJson] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const memoria = useMemoriaIa(isOpen);
  // Regla que el asistente ha sacado de lo que se le pidió: se guarda como
  // propuesta y aquí se pregunta si recordarla (no la usa hasta aprobarla).
  const [propuesta, setPropuesta] = useState(null);

  if (!isOpen) return null;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, apiKey.trim());
    setShowApiKeyInput(false);
  };

  const samplePrompts = [
    'Reorganiza las cargas de mañana para que cada conductor lleve el camión con el que ya ha ido esta semana.',
    'A partir de ahora, recuerda que las bodas de más de 200 pax llevan un apoyo más en la carga.',
    'Ajusta los horarios de la semana a lo que duran de verdad las tareas según los fichajes.'
  ];

  const handleGenerate = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMsg('');
    setGeneratedJson(null);
    setPropuesta(null);

    // La planificación y la posible regla nueva van a la vez (la regla no retrasa
    // la respuesta). El servidor no guarda duplicados.
    const [{ generatedJson: result, errorMsg: err }, recuerdo] = await Promise.all([
      generateScheduleWithGemini({ prompt, apiKey, activeWeekData, roster: workersList, aiMemories: memoria.activas, aprendizaje }),
      extraerMemoriaDelPrompt({ prompt, apiKey })
    ]);
    setGeneratedJson(result);
    if (err) setErrorMsg(err);

    if (recuerdo) {
      const regla = await memoria.proponer(recuerdo);
      if (regla?.estado === 'propuesta') setPropuesta(regla);
    }

    setLoading(false);
  };

  const handleApply = () => {
    if (generatedJson) {
      onApplyGeneratedSchedule(generatedJson);
      onClose();
    }
  };

  return (
    <Modal onCerrar={onClose} ancho="2xl">
      <CabeceraModal
        icono={Wand2}
        degradado="amber-indigo"
        titulo="Asistente Gemini AI"
        subtitulo="Genera planificaciones de eventos y rutas automáticamente"
        insignia={
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-indigo-500 text-slate-950">
            POWERED BY GEMINI
          </span>
        }
        acciones={
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`mr-10 p-2 rounded-xl transition-colors ${showApiKeyInput ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
            title="Configurar Gemini API Key"
          >
            <Key className="w-4 h-4" />
          </button>
        }
        className="mb-6"
      />

      {/* API Key Input Form */}
      {showApiKeyInput && (
        <form onSubmit={handleSaveApiKey} className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Google Gemini API Key (necesaria para generar)
          </label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              tamano="sm"
              fondo="medio"
              className="flex-1"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-400"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {/* Prompt Input Form */}
      <form onSubmit={handleGenerate} className="space-y-4">
        <Campo etiqueta="¿Qué quieres planificar con Gemini AI?">
          <AreaTexto
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Escribe tu solicitud (ej.: planifica la semana con dos bodas el sábado y reparte los tres camiones entre los conductores)..."
            tamano="xl"
            redondeo="2xl"
            acento="amber-suave"
            className="w-full transition-all"
          />
        </Campo>

        {/* Quick Sample Prompts */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-slate-400">Sugerencias rápidas:</span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((sp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(sp)}
                className="text-left text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 p-2.5 rounded-xl transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{sp}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-indigo-500 hover:opacity-95 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
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
      </form>

      {/* Error Message */}
      {errorMsg && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Regla propuesta: se recuerda solo si el admin dice que sí */}
      {propuesta && (
        <div role="status" className="mt-4 space-y-2 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3 animate-aparecer motion-reduce:animate-none">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-200">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" /> ¿Lo recuerdo para las próximas planificaciones?
          </p>
          <p className="text-sm text-slate-200">«{propuesta.content}»</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={async () => { if (await memoria.aprobar(propuesta._id)) setPropuesta(null); }} className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-400">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Recordar
            </button>
            <button type="button" onClick={async () => { await memoria.descartar(propuesta._id); setPropuesta(null); }} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white">
              <X className="h-3.5 w-3.5" aria-hidden="true" /> No hace falta
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Si no eliges, queda pendiente en Memoria IA.</p>
        </div>
      )}

      {/* Generated Schedule Preview */}
      {generatedJson && (
        <div className="mt-6 space-y-4 border-t border-slate-800 pt-6 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-amber-400 flex items-center space-x-1.5">
              <Check className="w-4 h-4" />
              <span>Planificación Generada por Gemini AI</span>
            </h4>
            <span className="text-[11px] text-slate-400">{generatedJson.meta?.week}</span>
          </div>

          {/* Qué cambia y qué revisar antes de aplicar (antes solo se veían las bodas del sábado) */}
          <CambiosPropuestos
            diff={diffSemana(activeWeekData, generatedJson)}
            avisos={avisosDeSemana(generatedJson, { equipo: workersList, camiones: (activeWeekData?.trucks || []).map(t => t?.name) })}
          />

          <button
            onClick={handleApply}
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Aplicar esta Planificación a la App</span>
          </button>
        </div>
      )}
    </Modal>
  );
}
